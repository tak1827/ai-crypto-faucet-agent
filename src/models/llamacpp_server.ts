import type { Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import { Env } from "../utils/env";
import logger from "../utils/logger";
import { LLamaCppModel } from "./llamacpp";

export type InferRequest = {
	prompt: string;
	temperature?: number;
	stopText?: string[];
};

export type EmbedRequest = {
	text: string;
};

export class LlamaCppServer {
	readonly host: string;
	readonly port: number;
	readonly token: string;
	readonly embedTimeout: number;
	#server?: Server;
	#inferModel: LLamaCppModel;
	#embedModel: LLamaCppModel;
	#closing = false;

	constructor(host: string, port: number, token: string, embedTimeout = 60000) {
		this.host = host;
		this.port = port;
		this.token = token;
		this.embedTimeout = embedTimeout;
		this.#inferModel = new LLamaCppModel(Env.path("WORKFLOW_MODEL_PATH"));
		this.#embedModel = new LLamaCppModel(Env.path("WORKFLOW_EMBEDDING_MODEL_PATH"));
	}

	async start(): Promise<void> {
		const app = express();
		app.use(express.json());

		await this.#inferModel.init();
		await this.#embedModel.init();

		const auth = (req: Request, res: Response, next: NextFunction) => {
			const authHeader = req.headers.authorization || "";
			if (authHeader !== `Bearer ${this.token}`) {
				res.status(401).json({ error: "Unauthorized" });
				return;
			}
			next();
		};

		app.get("/", (req: Request, res: Response) => {
			logger.info("[llamaserver] / called");
			res.json({ status: "ok" });
		});

		app.post("/infer", auth, async (req: Request, res: Response) => {
			logger.info("[llamaserver] /infer called");

			// validate request body
			const { prompt, temperature, stopText, err } = this.#validateInferRequest(req);
			if (err) {
				res.status(400).json({ error: err });
				return;
			}
			res.setHeader("Content-Type", "text/event-stream");
			res.setHeader("Cache-Control", "no-cache");
			res.setHeader("Connection", "keep-alive");
			res.flushHeaders();

			logger.debug(
				`[llamaserver] infer request: ${prompt.substring(0, 50)}.., temperature: ${temperature}, stopText: ${stopText}`,
			);

			try {
				const result = await this.#inferModel.infer(prompt, {
					temperature,
					stopText,
					onTextChunk: (chunk: string) => {
						const safeChunk = chunk.replace(/\n\n/g, "[BREAK]");
						res.write(`data:${safeChunk}\n\n`);
					},
				});
				res.write("data:[EOF]\n\n");
				logger.debug(`[llamaserver] infer result: ${result.substring(0, 50)}..`);
			} catch (err) {
				logger.error(err, "[llamaserver] infer error");
				res.write(`event: error\ndata:${(err as Error).message}\n\n`);
			} finally {
				res.end();
			}
		});

		app.post("/embedding", auth, async (req: Request, res: Response) => {
			logger.info("[llamaserver] /embedding called");

			// validate request body
			const { text, err } = this.#validateEmbeddingRequest(req);
			if (err) {
				res.status(400).json({ error: err });
				return;
			}

			// set timeout for embedding request
			res.setTimeout(this.embedTimeout);

			// embed the text
			try {
				const emb = await this.#embedModel?.embed(text);
				res.json({ embedding: emb });
			} catch (err) {
				logger.error(err, "[llamaserver] embedding error");
				res.status(500).json({ error: (err as Error).message });
			}
		});

		this.#server = app.listen(this.port, this.host, () => {
			logger.info(`[llamaserver] started on http://${this.host}:${this.port}`);
		});
	}

	async close(): Promise<void> {
		if (this.#closing) return;

		this.#closing = true;
		logger.info("[llamaserver] closing ...");

		// Close the models first
		await this.#inferModel.close();
		await this.#embedModel.close();

		// wait for the server to close
		if (this.#server) {
			await new Promise<void>((resolve) => {
				this.#server?.close(() => resolve());
			});
		}

		this.#closing = false;
		logger.info("[llamaserver] closed");
	}

	#validateInferRequest(req: Request): InferRequest & { err?: string } {
		const { prompt, temperature, stopText } = req.body as InferRequest;
		if (!prompt) {
			return { prompt: "", err: "prompt required" };
		}
		if (temperature) {
			if (typeof temperature !== "number" || temperature < 0 || temperature > 2) {
				return { prompt, err: "temperature must be a number between 0 and 2" };
			}
		}
		if (stopText) {
			if (!Array.isArray(stopText) || stopText.length === 0) {
				return { prompt, err: "stopText must be a non-empty array" };
			}
		}
		return { prompt, temperature, stopText: stopText };
	}

	#validateEmbeddingRequest(req: Request): EmbedRequest & { err?: string } {
		const { text } = req.body as { text?: string };
		if (!text) {
			return { text: "", err: "text required" };
		}
		return { text };
	}
}
