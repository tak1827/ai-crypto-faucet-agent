import { getChatHistories } from "../../entities";
import type { ILLMModel } from "../../models";
import { Env } from "../../utils/env";
import logger from "../../utils/logger";
import { instructedPostInfer } from "../infers/post_instruction";
import type { BaseWorkflowContext, WorkflowContext, WorkflowState } from "../workflow_manager";
import { handleErrors, lookupKnowledge, validateStateName } from "./common";

export type PostState = WorkflowState & {
	name: "post";
	instructions: string[];
};

export const createPostCtx = (baseCtx: BaseWorkflowContext): WorkflowContext => {
	const state: PostState = {
		name: "post",
		instructions: Env.array("WORKFLOW_POST_INSTRUCTIONS"),
	};
	baseCtx.models[state.name] = baseCtx.models.common;
	return { ...baseCtx, state };
};

export const postWork = async (ctx: WorkflowContext): Promise<Error | null> => {
	validateStateName(ctx.state, "post");

	const errs: Error[] = [];

	// Iterate through the following IDs
	for (const instruction of ctx.state.instructions) {
		try {
			// get own tweets
			const ownHistories = await getOwnHistories(ctx);

			// Post the tweet
			await postTweet(ctx, instruction, ownHistories);

			// Save ChatHistory
			await ctx.memory.commit();
		} catch (err) {
			logger.warn(err, "Error in post work");
			const errMsg = `${(err as Error).message} instruction: ${instruction}`;
			errs.push(new Error(errMsg));
		}
	}

	return handleErrors("post", errs);
};

const getOwnHistories = async (ctx: WorkflowContext, limit = 6): Promise<string> => {
	const histories = await getChatHistories(ctx.db, ctx.memory.ownId, null, limit);
	let result = "";
	for (const history of histories) {
		result += `${history.content}\n`;
	}
	return result;
};

const postTweet = async (
	ctx: WorkflowContext,
	instruction: string,
	chatHistories: string,
): Promise<{ id: string; content: string }> => {
	// Retrieve relevant knowledge from the database
	const emodel = ctx.models.embed as ILLMModel;
	const knowledge = await lookupKnowledge(emodel, ctx.db, instruction);

	// Infer the assistant reply
	const model = ctx.models[ctx.state.name] as ILLMModel;
	const assistantRely = await instructedPostInfer(model, chatHistories, instruction, knowledge);

	// Post the reply to Twitter
	const { id } = await ctx.twitter.createTweet(assistantRely);

	// Add assistant reply to memory
	await ctx.memory.add(ctx.memory.ownId, assistantRely, id);

	return { id, content: assistantRely };
};
