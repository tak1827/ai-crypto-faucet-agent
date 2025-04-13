import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AppDataSource } from "../../db/ormconfig";
import {
	AirdropHistory,
	ChatGroup,
	ChatHistory,
	SNSFollow,
	getAirdropHistories,
	getAllChatHistories,
} from "../../entities";
import type { mockTwitter } from "../../twitter/mock";
import { createBaseCtx } from "../workflow_manager";
import { airdropWork } from "./airdrop_work";

describe("workflow: airdrop", async () => {
	const baseCtx = await createBaseCtx(true, true);
	baseCtx.models.airdrop = baseCtx.models.common;
	const ctx: any = {
		...baseCtx,
		state: {
			name: "airdrop",
			recentPost: 2,
			exploreURL: "https://explorer.oasys.games",
			amount: "3",
		},
	};
	const db = baseCtx.db;
	const twitter = baseCtx.twitter as any as mockTwitter;
	const ownId = baseCtx.twitter.ownId || "111111";
	const memory = baseCtx.memory;
	const userId = "222222";
	const addr = "0x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b5640";

	beforeAll(async () => {
		const chats = [
			{
				id: "tweetchat1",
				createdAt: new Date(),
				assistant:
					"Battle of The Gods is a free-to-play, turn-based strategy game that combines elements of RPG and card games. Players can collect and upgrade cards, build their own decks, and battle against other players in real-time.",
			},
			{
				id: "tweetchat2",
				createdAt: new Date(),
				user: "How to play Battle of The Gods?",
			},
			{
				id: "tweetchat3",
				createdAt: new Date(),
				assistant:
					"To play Battle of The Gods, you need to collect cards and build your own deck. You can then battle against other players in real-time. The game also features a single-player mode where you can complete quests and earn rewards.",
			},
		];
		await db.saveEntities([
			new ChatHistory(ownId, "tweet1", "test message"),
			new ChatHistory(
				ownId,
				"tweet2",
				"Yukichi is now ready, let's go!, reply me if you want to airdrop",
			),
			new ChatHistory(ownId, "tweet3", "I'm Oasys faucet, please reply me with your address"),
			new ChatHistory(ownId, "tweet4", "test message", "tweet1"),
			new ChatGroup(ChatGroup.groupIdFromUserIds([ownId, userId]), chats),
			new SNSFollow(userId),
		]);
		twitter.setResGetTweetReplies({
			nextToken: "",
			replies: [
				{
					tweetId: "tweet2-reply1",
					userId,
					covId: "tweet2",
					content: `Here is my address: ${addr}`,
				},
				{
					tweetId: "tweet3-reply1",
					userId,
					covId: "tweet3",
					content: `Give me airdrop as soon as possible. ${addr}`,
				},
			],
		});
	});

	afterAll(async () => {
		// delete airdrop histories
		await db.makeTransaction(async () => {
			await AppDataSource.getRepository(ChatHistory).delete({});
			await AppDataSource.getRepository(ChatGroup).delete({});
			await AppDataSource.getRepository(SNSFollow).delete({});
			await AppDataSource.getRepository(AirdropHistory).delete({});
		});
	});

	test("airdropWork works", async () => {
		const err = await airdropWork(ctx);
		expect(err).toBeNull();

		const airdops = await getAirdropHistories(db, userId);
		console.log("airdrops", airdops);
		expect(airdops.length).toBe(1);
		const llmChats = await memory.getLLMChatHistories([ownId, userId]);
		console.log("llmChats", llmChats);
		expect(llmChats.length).toBe(3 + 2 * 2);
		const histories = await getAllChatHistories(db);
		console.log("histories", histories);
		expect(histories.length).toBe(4 + 2 * 2);
	});
});
