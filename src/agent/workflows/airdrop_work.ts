import { Chain } from "../../chain";
import { AirdropHistory, getAirdropHistories } from "../../entities/airdrop_history_entity";
import { getChatHistories, getChatHistory } from "../../entities/chat_history_entity";
import { isFollowingSNS } from "../../entities/sns_follow_entity";
import type { ILLMModel } from "../../models";
import logger from "../../utils/logger";
import { judgeRequestingAirdropInfer } from "../infers/judge_request_airdrop";
import { replyInfer } from "../infers/reply";
import { replyAirdropInfer } from "../infers/reply_airdrop";
import type { WorkflowContext, WorkflowState } from "../workflow_manager";
import { handleErrors, validateStateName } from "./common";

export type AirdropState = WorkflowState & {
	name: "airdrop";
	recentPost: number;
	exploreURL: string;
	amount: string; // Amount of airdrop in ETH
};

export const airdropWork = async (ctx: WorkflowContext): Promise<Error | null> => {
	validateStateName(ctx.state, "airdrop");

	const state = ctx.state as AirdropState;
	const model = ctx.models[state.name] as ILLMModel;
	const newReplies = await getNewReplies(ctx, state.ownerId, state.recentPost);
	const errs: Error[] = [];

	for (const r of newReplies) {
		try {
			const chatHistories = JSON.stringify(
				await ctx.memory.getLLMChatHistories([ctx.memory.ownId, r.userId]),
			);
			let assistantRely: string;

			// Add the new reply to memory
			await ctx.memory.add(r.userId, r.content, r.tweetId, {
				userId2: ctx.memory.ownId,
				referenceId: r.covId,
			});

			if (await isAirdrop(model, r.content)) {
				// User requesting airdrop, so try to airdrop
				assistantRely = await tryAirdorp(ctx, r.userId, r.content, chatHistories);
			} else {
				// Otherwise, chat with user
				assistantRely = await replyInfer(model, chatHistories, r.content);
			}

			// Post the reply to Twitter
			const { id } = await ctx.twitter.createTweet(assistantRely, r.covId);

			// Add assistant reply to memory
			await ctx.memory.add(ctx.memory.ownId, assistantRely, id, {
				userId2: r.userId,
				referenceId: r.covId,
			});

			// Save ChatHistory and ChatGroup
			await ctx.memory.commit();
		} catch (err) {
			logger.warn(err, "Error in airdrop work");
			const errMsg = `${(err as Error).message} userId: ${r.userId}, tweetId: ${r.tweetId}, message: ${r.content}`;
			errs.push(new Error(errMsg));
		}
	}

	return handleErrors("airdrop", errs);
};

const getNewReplies = async (
	ctx: WorkflowContext,
	ownId: string,
	limit: number,
): Promise<{ tweetId: string; userId: string; covId: string; content: string }[]> => {
	// get own tweets
	const ownTweets = await getChatHistories(ctx.db, ownId, null, limit);
	// get replies of own tweets
	const replies = await ctx.twitter.getTweetReplies(ownTweets.map((tweet) => tweet.externalId));
	// kick off already handled replies
	const newReplies = replies.replies.filter(async (reply) => {
		if (reply.userId === ownId) return false; // Exclude own tweet
		const history = await getChatHistory(ctx.db, reply.userId, reply.tweetId);
		return history === null;
	});
	return newReplies;
};

const isAirdrop = async (model: ILLMModel, query: string): Promise<boolean> =>
	Chain.containsEthAddress(query) && (await judgeRequestingAirdropInfer(model, query));

const canAirdrop = async (
	ctx: WorkflowContext,
	userId: string,
): Promise<{ can: boolean; reason: string }> => {
	let reason = "";
	let can = true;

	// Check airdorp history
	const airdropHistories = await getAirdropHistories(ctx.db, userId);
	if (airdropHistories.length > 0) {
		can = false;
		reason += "Already airdorp sent. Not allowed to request airdrop multiple times.";
	}

	// Check sns following
	const isFollowing = await isFollowingSNS(ctx.db, userId);
	if (!isFollowing) {
		can = false;
		reason += "Not following ower SNS, please follow our SNS.";
	}

	return { can, reason };
};

const tryAirdorp = async (
	ctx: WorkflowContext,
	userId: string,
	query: string,
	chatHistories: string,
): Promise<string> => {
	const state = ctx.state as AirdropState;
	const model = ctx.models[state.name] as ILLMModel;

	const { can, reason } = await canAirdrop(ctx, userId);
	if (!can) {
		// Reply with the reason why can't airdrop
		return await replyAirdropInfer(model, chatHistories, query, false, reason);
	}

	const address = Chain.extractAddresses(query)[0] || "";
	const { hash, err } = await ctx.chain.sendEth(address, state.amount);
	if (err) {
		// Reply with the reason why airdop failed
		return await replyAirdropInfer(model, chatHistories, query, false, err);
	}

	// Save the airdrop history
	await ctx.db.saveEntities([new AirdropHistory(userId, address, Number(state.amount))]);

	// Reply with the airdrop transaction hash
	const assistantRely = await replyAirdropInfer(model, chatHistories, query, true);
	return `${assistantRely} Chek out the airdrop transaction: ${state.exploreURL}/tx/${hash}`;
};
