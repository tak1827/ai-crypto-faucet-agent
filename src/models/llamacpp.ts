import fs from "node:fs";
import { basename } from "node:path";
import {
	type ChatSessionModelFunctions,
	type ChatWrapper,
	JinjaTemplateChatWrapper,
	LlamaLogLevel,
} from "node-llama-cpp";
import {
	type LLamaChatPromptOptions,
	LlamaChatSession,
	type LlamaContext,
	type LlamaModel,
	getLlama,
} from "node-llama-cpp";
import type { Embedder, ILLMModel } from ".";
import logger from "../utils/logger";
import retry from "../utils/retry";

export class LLamaCppModel implements ILLMModel {
	public readonly modelPath: string;
	#abortController: AbortController = new AbortController();
	#model?: LlamaModel;
	#context?: LlamaContext;
	#defaultPromptOptions: Partial<LLamaChatPromptOptions> = {
		signal: this.#abortController.signal,
		trimWhitespaceSuffix: true,
		stopOnAbortSignal: true,
	};
	#chatWrapper: ChatWrapper | undefined;
	readonly #modelName: string;
	#closing = false;
	readonly #closingError: Error = new Error("closing! no more inference allowed");

	constructor(modelPath: string, opts: { templatePath?: string | undefined } = {}) {
		this.modelPath = this._validateModelPath(modelPath);
		this.#modelName = basename(modelPath);
		if (opts.templatePath)
			this.#chatWrapper = new JinjaTemplateChatWrapper({
				template: fs.readFileSync(opts.templatePath, "utf-8"),
			});
	}

	public async init(): Promise<ILLMModel> {
		const llama = await getLlama();
		this.#model = await llama.loadModel({ modelPath: this.modelPath });
		this.#model.llama.logLevel = LlamaLogLevel.warn;
		this.#context = await this.#model.createContext();
		return this;
	}

	public async close() {
		this.#closing = true;
		this.#abortController.abort();
		if (this.#context) await this.#context.dispose();
		if (this.#model) await this.#model.dispose();
		logger.info(`closed model: ${this.#modelName}`);
		this.#closing = false;
	}

	public name(): string {
		return this.#modelName;
	}

	public getSession(systemPrompt: string): LlamaChatSession {
		if (!this.#context) throw new Error("Not yet initialized");
		return new LlamaChatSession({
			contextSequence: this.#context.getSequence(),
			systemPrompt,
			autoDisposeSequence: true,
			chatWrapper: this.#chatWrapper || "auto",
		});
	}

	public async infer(
		query: string,
		opt?: {
			temperature?: number;
			stopText?: string[];
			session?: LlamaChatSession;
			onTextChunk?: (text: string) => void;
			functions?: ChatSessionModelFunctions;
		},
	): Promise<string> {
		if (this.#closing) throw this.#closingError;
		const session = opt?.session ? opt.session : this.getSession("");
		const result = await session.prompt(query, {
			...this.#defaultPromptOptions,
			temperature: opt?.temperature,
			customStopTriggers: opt?.stopText,
			onTextChunk: (text: string) => {
				logger.trace(`prompt chunk: ${text}`);
				if (opt?.onTextChunk) opt.onTextChunk(text);
			},
			functions: opt?.functions as any,
		});
		if (!opt || !opt.session) session.dispose();
		return result;
	}

	public async inferStructured<T>(
		query: string,
		encode: <T>(response: string) => T,
		opt?: {
			temperature?: number;
			stopText?: string[];
			session: LlamaChatSession;
		},
		retries = 2,
	): Promise<T> {
		return await retry<T>(retries, async (): Promise<T> => {
			const response = await this.infer(query, opt);
			return encode(response);
		});
	}

	// public async *promptStream(
	// 	session: LlamaChatSession,
	// 	query: string,
	// 	opt?: {
	// 		temperature?: number;
	// 		stopText?: string[];
	// 	},
	// ): AsyncGenerator<string> {
	// 	const chunks: string[] = [];
	// 	let resolve: ((value: string) => void) | null = null;
	// 	let reject: ((reason?: any) => void) | null = null;

	// 	const chunkPromise = () =>
	// 		new Promise<string>((res, rej) => {
	// 			resolve = res;
	// 			reject = rej;
	// 		});

	// 	session
	// 		.prompt(query, {
	// 			...this.#defaultPromptOptions,
	// 			temperature: opt?.temperature,
	// 			customStopTriggers: opt?.stopText,
	// 			onTextChunk: (text: string) => {
	// 				if (resolve) {
	// 					resolve(text);
	// 				} else {
	// 					chunks.push(text);
	// 				}
	// 			},
	// 		})
	// 		.then(() => {
	// 			if (resolve) {
	// 				resolve("");
	// 			}
	// 		})
	// 		.catch((err) => {
	// 			if (reject) {
	// 				reject(err);
	// 			}
	// 		});

	// 	while (true) {
	// 		if (chunks.length > 0) {
	// 			yield chunks.shift()!;
	// 		} else {
	// 			const chunk = await chunkPromise();
	// 			if (chunk === "") {
	// 				break;
	// 			}
	// 			yield chunk;
	// 		}
	// 	}
	// }

	public async embed(text: string): Promise<readonly number[]> {
		if (this.#closing) throw this.#closingError;
		let result: readonly number[] | undefined;
		await this.embedContext(async (embedder) => {
			result = await embedder(text);
		});
		return result || [];
	}

	public async embedContext(task: (_embedder: Embedder) => Promise<void>) {
		if (this.#closing) throw this.#closingError;
		if (!this.#model) throw new Error("Model not initialized");
		const context = await this.#model.createEmbeddingContext();
		const embedder = async (text: string) => (await context.getEmbeddingFor(text)).vector;
		await task(embedder);
		context.dispose();
	}

	private _validateModelPath(modelPath: string): string {
		if (!fs.existsSync(modelPath)) {
			throw new Error(`path not found: ${modelPath}`);
		}
		if (!modelPath.endsWith(".gguf")) {
			// Ensure that the file extension is `.gguf`
			throw new Error("Unsupported model. Expected a `.gguf` file");
		}
		return modelPath;
	}
}
