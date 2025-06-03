import type { Database } from "../../db";
import { type DocumentChunk, DocumentCore } from "../../entities";
import type { ILLMModel } from "../../models";
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
	topK = 5,
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
				where: { id: entity.documentCore.id },
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
