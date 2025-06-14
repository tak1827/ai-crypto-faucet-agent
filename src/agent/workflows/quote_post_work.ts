import { getChatHistories } from "../../entities";
import type { ILLMModel } from "../../models";
import { Twitter } from "../../twitter";
import { Env } from "../../utils/env";
import logger from "../../utils/logger";
import { randSelect } from "../../utils/rand";
import { instructedQuotePostInfer } from "../infers/quote_post_instruction";
import type { BaseWorkflowContext, WorkflowContext, WorkflowState } from "../workflow_manager";
import { handleErrors, lookupRerankedKnowledge, validateStateName } from "./common";

export type QuotePostState = WorkflowState & {
	name: "quote-post";
	followingIds: string[];
};

export const createQuotePostCtx = (baseCtx: BaseWorkflowContext): WorkflowContext => {
	const state: QuotePostState = {
		name: "quote-post",
		followingIds: Env.array("WORKFLOW_FOLLOWING_IDS"),
	};
	baseCtx.models[state.name] = baseCtx.models.common;
	return { ...baseCtx, state };
};

export const quotePostWork = async (ctx: WorkflowContext): Promise<Error | null> => {
	validateStateName(ctx.state, "quote-post");

	const errs: Error[] = [];

	// Randomly select a following ID
	if (ctx.state.followingIds.length === 0)
		throw new Error("No following IDs available for QuotePost work");
	const followingId = randSelect<string>(ctx.state.followingIds);
	logger.info(`QuotePost work for followingId: ${followingId}`);

	// Filter unquoted tweets from the followingId
	const unquoteds = await filterUnQuotedTweet(ctx, followingId);
	if (unquoteds.length === 0) {
		logger.info(`No new tweets to quote from followingId: ${followingId}`);
		return null;
	}

	// Randomly select an unquoted tweet
	const quoting = randSelect<{ id: string; content: string }>(unquoteds);
	logger.info(
		`Selected quoting tweet: ${quoting.id}, contents: ${quoting.content.substring(0, 200)}...`,
	);

	try {
		// QuotePost the tweet
		const { content } = await quotePostTweet(ctx, quoting, followingId);
		logger.info(`QuotePosted own tweet: ${content}`);

		// Save ChatHistory
		await ctx.memory.commit();
	} catch (err) {
		const newErr = new Error(
			`${(err as Error).message} quoting: ${quoting.content.substring(0, 50)}...`,
		);
		// Immediately stop if closing
		if ((err as Error).message.startsWith("closing!")) throw newErr;
		// Otherwise, log the error
		logger.warn(err, "Error in quote post work");
		errs.push(newErr);
	}

	if (errs.length !== 0) handleErrors("quote-post", errs);

	logger.info("QuotePost work completed successfully");
	return null;
};

const filterUnQuotedTweet = async (
	ctx: WorkflowContext,
	followingId: string,
): Promise<{ id: string; content: string }[]> => {
	// Get chat histories for the followingId
	const histories = await getChatHistories(ctx.db, followingId, null, 10);

	const filteredTweets = [] as { id: string; content: string }[];
	for (const history of histories) {
		if (history.content.length < 100) continue; // Skip if content is too short
		const referenceId = Twitter.getTweetUrl(followingId, history.externalId);
		const quotePosts = await getChatHistories(ctx.db, ctx.memory.ownId, referenceId, 1);
		if (quotePosts.length > 0) continue; // Skip if already quoted
		filteredTweets.push({ id: history.externalId, content: history.content });
	}
	return filteredTweets;
};

const quotePostTweet = async (
	ctx: WorkflowContext,
	quoting: { id: string; content: string },
	followingId: string,
): Promise<{ id: string; content: string }> => {
	// Retrieve relevant knowledge from the database
	const emodel = ctx.models.embed as ILLMModel;
	const knowledge = await lookupRerankedKnowledge(emodel, ctx.db, quoting.content, {
		weight: { distance: 0.7, recency: 0.3 },
		topK: 4,
		chatWhereQuery: `identifier <> '${ctx.memory.ownId}' AND "externalId" <> '${quoting.id}'`,
	});

	// Infer the assistant reply
	const model = ctx.models[ctx.state.name] as ILLMModel;
	let assistantRely = await instructedQuotePostInfer(model, quoting.content, knowledge);

	// Append the original tweet URL to the assistant reply
	const tweetUrl = Twitter.getTweetUrl(followingId, quoting.id);
	assistantRely += `\n\n${tweetUrl}`;

	// QuotePost the reply to Twitter
	const { id } = await ctx.twitter.createTweet(assistantRely);

	// Add assistant reply to memory
	const referenceId = Twitter.getTweetUrl(followingId, quoting.id);
	await ctx.memory.add(ctx.memory.ownId, assistantRely, id, { referenceId });

	return { id, content: assistantRely };
};
