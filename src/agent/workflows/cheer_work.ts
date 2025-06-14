import { DocumentChunk, DocumentCore, getChatHistoryByRefId } from "../../entities";
import type { ILLMModel } from "../../models";
import { Env } from "../../utils/env";
import logger from "../../utils/logger";
import { type ContentFetcher, ContentType, fetchArticlesFromText } from "../../utils/web";
import { replyCheer } from "../infers/cheer";
import type { BaseWorkflowContext, WorkflowContext, WorkflowState } from "../workflow_manager";
import { handleErrors, lookupRerankedKnowledge, validateStateName } from "./common";

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
				// Save the tweet to memory
				await ctx.memory.add(followingId, tweet.content, tweet.id);

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
			const newErr = new Error(`${(err as Error).message} followingId: ${followingId}`);
			// Immediately stop if closing
			if ((err as Error).message.startsWith("closing!")) throw newErr;
			// Otherwise, log the error
			logger.warn(err, "Error in cheer work");
			errs.push(newErr);
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
	const emodel = ctx.models.embed as ILLMModel;

	// Fetch articles from the tweet content
	const articles = await fetchArticlesFromText(tweet.content, ctx.twitter.contentFetchers);
	let extendContent = tweet.content;
	let fetchedWebContent = "";
	for (const art of articles) {
		if (art.type === ContentType.Web) {
			logger.debug(`Fetched web title: ${art.title}`);
			fetchedWebContent += art.content;
			await saveWebArticle(ctx, tweet.id, art.title, art.content);
		} else if (art.type === ContentType.Tweet) {
			logger.debug(`Fetched tweet title: ${art.title}`);
			extendContent += `\n${art.content}`;
		}
	}

	// Retrieve relevant knowledge from the database using the combined query
	const dbKnowledge = await lookupRerankedKnowledge(
		emodel,
		ctx.db,
		extendContent,
		ctx.memory.ownId,
	);
	const knowledge = `${fetchedWebContent}\n${dbKnowledge}`;

	// Infer the assistant reply
	const model = ctx.models[ctx.state.name] as ILLMModel;
	const assistantRely = await replyCheer(model, extendContent, knowledge);

	// Post the reply to Twitter
	const { id } = await ctx.twitter.createTweet(assistantRely, tweet.id);

	// Add assistant reply to memory
	await ctx.memory.add(ctx.memory.ownId, assistantRely, id, { referenceId: tweet.id });

	return { id, content: assistantRely };
};

const saveWebArticle = async (
	ctx: WorkflowContext,
	tweetId: string,
	title: string,
	content: string,
): Promise<void> => {
	await ctx.db.makeTransaction(async (queryRunner) => {
		const core = new DocumentCore(title);
		core.content = content;
		await queryRunner.manager.save(core);

		const emodel = ctx.models.embed as ILLMModel;
		const chunk = new DocumentChunk(emodel.name(), content, core, { tweetId });
		const embeds = await emodel.embed(content);
		chunk.embedding = `[${embeds.join(",")}]`;
		await queryRunner.manager.save(chunk);
	});
};

const filterNewTweet = async (
	ctx: WorkflowContext,
	followingId: string,
): Promise<{ id: string; content: string }[]> => {
	const tweets = await ctx.twitter.getTweets(followingId);
	const filteredTweets = [] as { id: string; content: string }[];
	for (const tweet of tweets) {
		const history = await getChatHistoryByRefId(ctx.db, tweet.id);
		if (history !== null) continue; // Skip if the tweet is already replied to
		if (tweet.content.length < 100) {
			// Skip if the tweet is too short
			logger.debug(
				`Skipping tweet ${tweet.id} from ${followingId} due to short. length: ${tweet.content.length}, content: ${tweet.content}`,
			);
			continue;
		}
		filteredTweets.push(tweet);
	}
	return filteredTweets;
};
