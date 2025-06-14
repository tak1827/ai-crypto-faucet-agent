import type { Database } from "../../db";
import { type DocumentChunk, DocumentCore } from "../../entities";
import { type ILLMModel, type RerankSearchConfig, rerank } from "../../models";
import logger from "../../utils/logger";
import type { WorkflowState } from "../workflow_manager";

export const validateStateName = (state: WorkflowState, expectedName: string): void => {
	if (state.name !== expectedName) {
		throw new Error(`Invalid state type. expected: ${expectedName}, actual: ${state.type}`);
	}
};

export const handleErrors = (tag: string, errs: Error[]): Error | null => {
	if (errs.length > 0) {
		const errMsg = `tag: ${tag}, ${errs.length} errors occurred: ${errs.map((err) => err.message).join(", ")}`;
		return new Error(errMsg);
	}
	return null;
};

export const lookupKnowledge = async (
	model: ILLMModel,
	db: Database,
	query: string,
	topK = 3,
): Promise<string> => {
	const embedding = await model.embed(query);

	// Search by cosin similality
	const entities = await db.vectorSearch<DocumentChunk[]>(
		"document_chunk",
		"embedding",
		embedding,
		topK,
		{},
	);

	// Log the filenames
	const docCores: DocumentCore[] = [];
	await db.makeQuery(async (queryRunner) => {
		for (const entity of entities) {
			const core = await queryRunner.manager.findOne(DocumentCore, {
				where: { id: entity.documentCoreId },
			});
			if (core) docCores.push(core);
		}
	});
	logger.debug(
		`Retrieved ${entities.length} docs. filenames: ${docCores.map((c) => c.fileName).join(", ")}`,
	);

	// Concatenate the content of the top K chunks
	return entities.map((e) => e.chunk).join("\n");
};

export const lookupAllKnowledge = async (
	model: ILLMModel,
	db: Database,
	query: string,
	topK = 3,
): Promise<string> => {
	const embedding = await model.embed(query);

	// Search by cosin similality
	const entities = await db.vectorSearchTables(
		[
			{ tableName: "chat_history", textCol: "content" },
			{ tableName: "document_chunk", textCol: "chunk" },
		],
		embedding,
		topK,
	);

	// Log content
	const concatedContent = entities.reduce((acc, entity) => {
		return `${acc}\n${entity.text.substring(0, 100)}`;
	}, "");
	logger.debug(`Retrieved ${entities.length} entities. Content: ${concatedContent}`);

	// Concatenate the content of the top K chunks
	return entities.map((e) => e.text).join("\n");
};

export const lookupRerankedKnowledge = async (
	model: ILLMModel,
	db: Database,
	query: string,
	ownId: string,
	topK?: number,
	topKOfEachTable?: number,
): Promise<string> => {
	const searchConfigs: RerankSearchConfig[] = [
		{
			tableName: "chat_history",
			source: "chat",
			textColumn: "content",
			whereQuery: `identifier <> '${ownId}'`,
		},
		{ tableName: "document_chunk", source: "doc", textColumn: "chunk" },
	];

	const results = await rerank(
		model,
		db,
		query,
		searchConfigs,
		{ distance: 0.7, recency: 0.3 },
		topK,
		topKOfEachTable,
	);

	// log the results
	const concatedContent = results.reduce((acc, result) => {
		return `${acc}\n source: ${result.source}, score: ${result.score}, content: ${result.text.substring(0, 100)}`;
	}, "");
	logger.debug(`Reranked: ${concatedContent}`);

	// Concatenate the content of the top K chunks
	return results.map((r) => r.text).join("\n");
};
