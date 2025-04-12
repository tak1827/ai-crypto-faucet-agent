import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "../../db";
import { AppDataSource } from "../../db/ormconfig";
import { ChatHistory, getAllChatHistories } from "../../entities";
import { LLamaCppModel } from "../../models/llama_cpp";
import type { Twitter } from "../../twitter";
import { mockTwitter } from "../../twitter/mock";
import { Memory } from "../memory";
import { cheerWork } from "./cheer_work";

const modelPath = "./data/models/gemma-3-4b-it-Q4_K_M.gguf";

describe("workflow: cheer", async () => {
	const ownId = "111111";
	const followingIds = ["following-1", "following-2"];
	const db = await new Database(AppDataSource).init();
	const model = await new LLamaCppModel(modelPath).init();
	const memory = Memory.create(db, ownId);
	const twitter: any = new mockTwitter();
	const ctx: any = {
		db,
		twitter: twitter as Twitter,
		models: { cheer: model, embed: model },
		memory,
		state: {
			name: "cheer",
			followingIds,
		},
	};

	beforeAll(async () => {
		await db.saveEntities([
			new ChatHistory(followingIds[0], "tweet-id-1", "test message", "tweet1"),
			new ChatHistory(followingIds[1], "tweet-id-2", "test message", "tweet13"),
		]);
		twitter.setResGetTweets(followingIds[0], [
			{
				id: "tweet1",
				content: "test message",
			},
			{
				id: "tweet2",
				content: "Battle of The Gods is a now recorded 100M pre retistration. Don't miss it!",
			},
			{
				id: "tweet3",
				content:
					"Play to earn! Join the battle now!, Battle of The Gods is a skyrocketing game with 100M pre registration",
			},
		]);
		twitter.setResGetTweets(followingIds[1], [
			{
				id: "tweet13",
				content: "test message",
			},
		]);
	});

	afterAll(async () => {
		// delete cheer histories
		await db.makeTransaction(async () => {
			await AppDataSource.getRepository(ChatHistory).delete({});
		});
	});

	test("cheerWork works", async () => {
		const err = await cheerWork(ctx);
		expect(err).toBeNull();

		const histories = await getAllChatHistories(db);
		console.log("histories", histories);
		expect(histories.length).toBe(2 + 2); // 2 original + 2 replies
	});
});
