import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Chain } from "../../chain";
import { Database } from "../../db";
import { AppDataSource } from "../../db/ormconfig";
import {
	AirdropHistory,
	ChatGroup,
	ChatHistory,
	SNSFollow,
	getAirdropHistories,
	getAllChatHistories,
} from "../../entities";
import { LLamaCppModel } from "../../models/llama_cpp";
import type { ResGetTweetReplies, Twitter } from "../../twitter";
import { Memory } from "../memory";
import type { WorkflowContext } from "../workflow_manager";
import { AirdropWork } from "./airdrop_work";

const modelPath = "./data/models/gemma-3-4b-it-Q4_K_M.gguf";

class mockTwitter {
	#resGetTweetReplies: ResGetTweetReplies | undefined;
	#createTweetCounter = 0;
	setResGetTweetReplies(res: ResGetTweetReplies) {
		this.#resGetTweetReplies = res;
	}
	async createTweet(text: string, covId: string): Promise<{ id: string }> {
		this.#createTweetCounter++;
		return { id: `mock-tweet-${this.#createTweetCounter}` };
	}
	async getTweetReplies(tweetIds: string[], nextToken?: string): Promise<ResGetTweetReplies> {
		if (!this.#resGetTweetReplies) throw new Error("getTweetReplies not set");
		return this.#resGetTweetReplies;
	}
}

describe("workflow: airdrop", async () => {
	const ownId = "111111";
	const userId = "222222";
	const addr = "0x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b5640";
	const chain = Chain.create();
	const db = await new Database(AppDataSource).init();
	const model = await new LLamaCppModel(modelPath).init();
	const memory = Memory.create(db, ownId);
	const twitter: any = new mockTwitter();
	const ctx: WorkflowContext = {
		db,
		twitter: twitter as Twitter,
		models: { airdrop: model },
		chain,
		memory,
		state: {
			name: "airdrop",
			recentPost: 2,
			exploreURL: "https://explorer.oasys.games",
			amount: "3",
		},
	};

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

	test("AirdropWork works", async () => {
		const err = await AirdropWork(ctx);
		expect(err).toBeNull();

		const airdops = await getAirdropHistories(db, userId);
		console.log("airdrops", airdops);
		expect(airdops.length).toBe(1);
		const llmChats = await memory.getLLMChatHistories(userId);
		console.log("llmChats", llmChats);
		expect(llmChats.length).toBe(3 + 2 * 2);
		const histories = await getAllChatHistories(db);
		console.log("histories", histories);
		expect(histories.length).toBe(3 + 2 * 2);
	});
});
