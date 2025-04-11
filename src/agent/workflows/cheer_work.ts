import { getChatHistoryByRefId } from "../../entities";
import type { ILLMModel } from "../../models";
import logger from "../../utils/logger";
import { replyCheer } from "../infers/cheer";
import type { WorkflowContext, WorkflowState } from "../workflow_manager";
import { handleErrors, lookupKnowledge, validateStateName } from "./common";

export type CheerState = WorkflowState & {
	name: "cheer";
	followingIds: string[];
};

export const cheerWork = async (ctx: WorkflowContext): Promise<Error | null> => {
	validateStateName(ctx.state, "cheer");

	const errs: Error[] = [];

	// Iterate through the following IDs
	for (const followingId of ctx.state.followingIds) {
		try {
			// Get the new tweets from the following ID
			const tweets = await filterNewTweet(ctx, followingId);

			for (const tweet of tweets) {
				// Like the tweet
				await ctx.twitter.likeTweet(followingId, tweet.id);

				// Cheer the tweet by replying
				await cheeringReply(ctx, tweet);
			}

			// Save ChatHistory
			await ctx.memory.commit();
		} catch (err) {
			logger.warn(err, "Error in cheer work");
			const errMsg = `${(err as Error).message} followingId: ${followingId}`;
			errs.push(new Error(errMsg));
		}
	}

	return handleErrors("cheer", errs);
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
