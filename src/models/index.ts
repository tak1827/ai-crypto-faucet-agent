import type { Database } from "../db";
import { Env } from "../utils/env";
import { LLamaCppModel } from "./llamacpp";
import { LlamaCppClient } from "./llamacpp_client";

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
	} else if (modelName && modelName === LlamaCppClient.name) {
		const host = Env.string("LLM_SERVER_HOST");
		const port = Env.number("LLM_SERVER_PORT");
		const token = Env.string("LLM_SERVER_TOKEN");
		model = await new LlamaCppClient(host, port, token).init();
	} else {
		const templatePath = process.env.LLM_TEMPLATE_PATH;
		model = await new LLamaCppModel(Env.path("LLM_MODEL_PATH"), { templatePath }).init();
	}
	if (model === undefined) throw new Error(`model ${modelName} not found`);
	return model;
};

export const createInitalizedEmbModel = async (modelName?: string): Promise<ILLMModel> => {
	if (modelName === LlamaCppClient.name) {
		const host = Env.string("LLM_SERVER_HOST");
		const port = Env.number("LLM_SERVER_PORT");
		const token = Env.string("LLM_SERVER_TOKEN");
		return await new LlamaCppClient(host, port, token).init();
	}
	return await new LLamaCppModel(Env.path("LLM_EMBEDDING_MODEL_PATH")).init();
};

export type RerankResult = {
	text: string;
	updatedAt: Date;
	distance: number;
	source: string;
	score: number;
};

export type RerankSearchConfig = {
	tableName: string;
	source: string;
	textColumn: string;
	filter?: { [key: string]: any };
	whereQuery?: string;
};

export type RerankWeight = {
	distance: number;
	recency: number;
};

export const rerank = async (
	model: ILLMModel,
	db: Database,
	query: string,
	searches: RerankSearchConfig[],
	weight: RerankWeight = { distance: 0.7, recency: 0.3 },
	scoreThreshold = 0.5,
	topK = 3,
	topKOfEachTable = 5,
): Promise<RerankResult[]> => {
	const embedding = await model.embed(query);

	const results = await Promise.all(
		searches.map((s) =>
			db.vectorSearch<any>(
				s.tableName,
				"embedding",
				embedding,
				topKOfEachTable,
				s.filter,
				s.whereQuery,
			),
		),
	);

	const merged: RerankResult[] = results.flatMap((rows, idx) => {
		const conf = searches[idx];
		if (!conf) return [];
		return rows.map((r: any) => ({
			text: r[conf.textColumn] as string,
			updatedAt: r.updatedAt as Date,
			distance: r._distance ?? 1,
			source: conf.source,
		}));
	});

	if (merged.length === 0) return [];

	const maxDist = Math.max(...merged.map((m) => m.distance));
	const minDist = Math.min(...merged.map((m) => m.distance));
	const maxDate = Math.max(...merged.map((m) => m.updatedAt.getTime()));
	const minDate = Math.min(...merged.map((m) => m.updatedAt.getTime()));

	const rangeDist = maxDist - minDist || 1;
	const rangeDate = maxDate - minDate || 1;

	const scored = merged
		.map((m) => {
			const normDist = 1 - (m.distance - minDist) / rangeDist;
			const normDate = (m.updatedAt.getTime() - minDate) / rangeDate;
			const score = weight.distance * normDist + weight.recency * normDate;
			return { ...m, score };
		})
		.sort((a, b) => b.score - a.score);

	return scored.slice(0, topK).filter((r) => r.score >= scoreThreshold);
};

export { LlamaCppClient, LLamaCppModel };
