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
	logger.info(`Starting embedding work for model: ${ctx.state.name}`);

	const errs: Error[] = [];
	const emodel = ctx.models.embed as ILLMModel;

	await ctx.db.makeTransaction(async (queryRunner) => {
		const repo = queryRunner.manager.getRepository(ChatHistory);
		const histories = await repo.find({ where: { embedding: IsNull() }, take: 20 });
		logger.info(`Found ${histories.length} histories to embed`);

		await emodel.embedContext(async (embedder) => {
			for (const history of histories) {
				try {
					const embeds = await embedder(history.content);
					history.embedding = `[${embeds.join(",")}]`;
					logger.debug(
						`Embedding history id: ${history.id} with content: ${history.content.substring(0, 20)}...`,
					);
					await queryRunner.manager.save(history);
				} catch (err) {
					logger.warn(err, `Embedding error id: ${history.id}`);
					errs.push(new Error(`${(err as Error).message} id: ${history.id}`));
				}
			}
		});
	});

	if (errs.length !== 0) handleErrors("post", errs);

	logger.info("Embedding work completed successfully.");
	return null;
};
