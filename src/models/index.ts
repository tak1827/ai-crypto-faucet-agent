import { Env } from "../utils/env";
import { LLamaCppModel } from "./llama_cpp";

export type Embedder = (_text: string) => Promise<readonly number[]>;

export interface ILLMModel {
	name(): string;
	init(): Promise<ILLMModel>;
	close(): Promise<void>;
	embed(_text: string): Promise<readonly number[]>;
	embedContext(_task: (_embedder: Embedder) => Promise<void>): Promise<void>;
	infer(query: string, opt?: Record<string, unknown>): Promise<string>;
	inferStructured<T>(
		query: string,
		encode: <T>(response: string) => T,
		opt?: Record<string, unknown>,
	): Promise<T>;
}

export const promptFromTemplate = (
	template: string,
	replacement: Record<string, string>,
): string => {
	let newTemplate = template;
	for (const key in replacement) {
		const regex = new RegExp(`<<-${key}->>`, "g");
		newTemplate = newTemplate.replace(regex, replacement[key] || "");
	}
	return newTemplate;
};

export const booleanEncoder = <T>(text: string): T => {
	const regex = /\b(true|false)\b/g;
	const matches = text.match(regex);
	if (matches === null) {
		throw new Error(`invalid response: ${text}`);
	}
	return (matches[0] === "true") as T;
};

export const createInitalizedModel = async (modelName?: string): Promise<ILLMModel> => {
	// Create the model
	let model: ILLMModel | undefined;
	if (modelName?.startsWith("openai")) {
		// const apiKey = Env.string('LLM_OPENAI_API_KEY')
		// const modelName = Env.string('LLM_OPENAI_MODEL')
		// const embeddingModelName = modelName.split(':')[1]
		// model = new OpenAIModel({ apiKey, modelName, embeddingModelName })
	} else {
		model = await new LLamaCppModel(Env.path("WORKFLOW_MODEL_PATH")).init();
	}
	if (model === undefined) throw new Error(`model ${modelName} not found`);
	return model;
};

export const createInitalizedEmbModel = async (): Promise<ILLMModel> => {
	return await new LLamaCppModel(Env.path("WORKFLOW_EMBEDDING_MODEL_PATH")).init();
};
