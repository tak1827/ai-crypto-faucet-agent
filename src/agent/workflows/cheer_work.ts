import { log } from "node:console";
import { getChatHistoryByRefId } from "../../entities";
import type { ILLMModel } from "../../models";
import { Env } from "../../utils/env";
import logger from "../../utils/logger";
import { replyCheer } from "../infers/cheer";
import type { BaseWorkflowContext, WorkflowContext, WorkflowState } from "../workflow_manager";
import { handleErrors, lookupKnowledge, validateStateName } from "./common";

export type CheerState = WorkflowState & {
	name: "cheer";
	followingIds: string[];
};

export const createCheerCtx = (baseCtx: BaseWorkflowContext): WorkflowContext => {
	const state: CheerState = {
		name: "cheer",
		followingIds: Env.array("WORKFLOW_FOLLOWING_IDS"),
	};
	baseCtx.models[state.name] = baseCtx.models.common;
	return { ...baseCtx, state };
};

export const cheerWork = async (ctx: WorkflowContext): Promise<Error | null> => {
	validateStateName(ctx.state, "cheer");

	const errs: Error[] = [];

	// Iterate through the following IDs
	let successCounter = 0;
	for (const followingId of ctx.state.followingIds) {
		try {
			// Get the new tweets from the following ID
			const tweets = await filterNewTweet(ctx, followingId);
			logger.info(`Cheering ${tweets.length} new tweets from ${followingId}`);

			for (const tweet of tweets) {
				// Like the tweet
				await ctx.twitter.likeTweet(tweet.id);
				logger.info(`Liked tweet ${tweet.id} from ${followingId}`);

				// Cheer the tweet by replying
				const { content } = await cheeringReply(ctx, tweet);
				logger.info(`Replied to tweet ${tweet.id} with content: ${content}`);
				successCounter++;
			}

			// Save ChatHistory
			await ctx.memory.commit();
		} catch (err) {
			logger.warn(err, "Error in cheer work");
			const errMsg = `${(err as Error).message} followingId: ${followingId}`;
			errs.push(new Error(errMsg));
		}
	}

	if (errs.length !== 0) handleErrors("cheer", errs);

	logger.info(`Cheer work completed successfully. replies: ${successCounter}`);
	return null;
};

const cheeringReply = async (
	ctx: WorkflowContext,
	tweet: { id: string; content: string },
): Promise<{ id: string; content: string }> => {
	// Retrieve relevant knowledge from the database
	const emodel = ctx.models.embed as ILLMModel;
	const knowledge = await lookupKnowledge(emodel, ctx.db, tweet.content);

	// Infer the assistant reply
	const model = ctx.models[ctx.state.name] as ILLMModel;
	const assistantRely = await replyCheer(model, tweet.content, knowledge);

	// Post the reply to Twitter
	const { id } = await ctx.twitter.createTweet(assistantRely, tweet.id);

	// Add assistant reply to memory
	await ctx.memory.add(ctx.memory.ownId, assistantRely, id, { referenceId: tweet.id });

	return { id, content: assistantRely };
};

const filterNewTweet = async (
	ctx: WorkflowContext,
	followingId: string,
): Promise<{ id: string; content: string }[]> => {
	const tweets = await ctx.twitter.getTweets(followingId);
	const filteredTweets = [] as { id: string; content: string }[];
	for (const tweet of tweets) {
		const history = await getChatHistoryByRefId(ctx.db, tweet.id);
		if (history === null) filteredTweets.push(tweet);
	}
	return filteredTweets;
};
