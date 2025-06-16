import type { ILLMModel } from "../../models";
import { Env } from "../../utils/env";
import logger from "../../utils/logger";
import { ContentType, fetchArticlesFromText } from "../../utils/web";
import { replyCheer } from "../infers/cheer";
import type { BaseWorkflowContext, WorkflowContext, WorkflowState } from "../workflow_manager";
import { lookupRerankedKnowledge, validateStateName } from "./common";

export type CheerSimulationState = WorkflowState & {
	name: "cheer-sim";
	tweetId: string;
};

export const createCheerSimulationCtx = (baseCtx: BaseWorkflowContext): WorkflowContext => {
	const state: CheerSimulationState = {
		name: "cheer-sim",
		tweetId: Env.string("WORKFLOW_CHEER_TARGET_TWEET_ID"),
	};
	baseCtx.models[state.name] = baseCtx.models.common;
	return { ...baseCtx, state };
};

export const cheerWorkSimulation = async (ctx: WorkflowContext): Promise<Error | null> => {
	validateStateName(ctx.state, "cheer-sim");

	try {
		const tweet = await ctx.twitter.findTweetById(ctx.state.tweetId);
		logger.info(`Cheer simulation for tweet ${tweet.id}`);

		const { content } = await cheeringReplySimulation(ctx, tweet);
		logger.info(`Replied to tweet ${tweet.id} with content:\n ${content}`);
	} catch (err) {
		logger.warn(err, "Error in cheer simulation work");
		return err as Error;
	}
	return null;
};

const cheeringReplySimulation = async (
	ctx: WorkflowContext,
	tweet: { id: string; content: string },
): Promise<{ content: string }> => {
	const emodel = ctx.models.embed as ILLMModel;

	const articles = await fetchArticlesFromText(tweet.content, ctx.twitter.contentFetchers);
	let extendContent = tweet.content;
	let fetchedWebContent = "";
	for (const art of articles) {
		if (art.type === ContentType.Web) {
			logger.debug(`Fetched web title: ${art.title}`);
			fetchedWebContent += art.content;
		} else if (art.type === ContentType.Tweet) {
			logger.debug(`Fetched tweet title: ${art.title}`);
			extendContent += `\n${art.content}`;
		}
	}

	const dbKnowledge = await lookupRerankedKnowledge(emodel, ctx.db, extendContent, {
		weight: { distance: 0.8, recency: 0.2 },
		scoreThreshold: 0.7,
		chatWhereQuery: `identifier <> '${ctx.memory.ownId}' AND "externalId" <> '${tweet.id}'`,
	});
	const knowledge = `${fetchedWebContent}\n${dbKnowledge}`;

	const model = ctx.models[ctx.state.name] as ILLMModel;
	const assistantRely = await replyCheer(model, extendContent, knowledge);

	return { content: assistantRely };
};
