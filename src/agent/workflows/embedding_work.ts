import { IsNull } from "typeorm";
import { ChatHistory } from "../../entities/chat_history_entity";
import type { ILLMModel } from "../../models";
import logger from "../../utils/logger";
import type { BaseWorkflowContext, WorkflowContext, WorkflowState } from "../workflow_manager";
import { handleErrors, validateStateName } from "./common";

export type EmbeddingState = WorkflowState & {
	name: "embedding";
};

export const createEmbeddingCtx = (baseCtx: BaseWorkflowContext): WorkflowContext => {
	const state: EmbeddingState = { name: "embedding" };
	baseCtx.models[state.name] = baseCtx.models.embed;
	return { ...baseCtx, state };
};

export const embeddingWork = async (ctx: WorkflowContext): Promise<Error | null> => {
	validateStateName(ctx.state, "embedding");

	const errs: Error[] = [];
	const model = ctx.models[ctx.state.name] as ILLMModel;

	await ctx.db.makeTransaction(async (queryRunner) => {
		const repo = queryRunner.manager.getRepository(ChatHistory);
		const histories = await repo.find({ where: { embedding: IsNull() } });

		await model.embedContext(async (embedder) => {
			for (const history of histories) {
				try {
					const embeds = await embedder(history.content);
					history.embedding = `[${embeds.join(",")}]`;
					await repo.save(history);
				} catch (err) {
					logger.warn(err, `Embedding error id: ${history.id}`);
					errs.push(new Error(`${(err as Error).message} id: ${history.id}`));
				}
			}
		});
	});

	return handleErrors("embedding", errs);
};
