import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "../../db";
import { AppDataSource } from "../../db/ormconfig";
import { ChatHistory, getAllChatHistories } from "../../entities";
import { LLamaCppModel } from "../../models/llama_cpp";
import type { Twitter } from "../../twitter";
import { mockTwitter } from "../../twitter/mock";
import { Memory } from "../memory";
import type { WorkflowContext } from "../workflow_manager";
import { postWork } from "./post_work";

const modelPath = "./data/models/gemma-3-4b-it-Q4_K_M.gguf";

describe("workflow: post", async () => {
	const ownId = "111111";
	const db = await new Database(AppDataSource).init();
	const model = await new LLamaCppModel(modelPath).init();
	const memory = Memory.create(db, ownId);
	const twitter: any = new mockTwitter();
	const ctx: any = {
		db,
		twitter: twitter as Twitter,
		models: { post: model, embed: model },
		memory,
		state: {
			name: "post",
			instructions: [
				"Airdrop OAS to followers to cheer up Oasys Ecosystem. Prompt user to reply with their address",
				"Cheer up Yukichi.fun to achieve more than 1000 meme tokens to be issued in a week after the launch",
			],
		},
	};

	beforeAll(async () => {
		await db.saveEntities([
			new ChatHistory(ownId, "tweet1", "Faucet is ready, please reply me with your address"),
			new ChatHistory(ownId, "tweet2", "test content", "tweet1"),
			new ChatHistory(
				ownId,
				"tweet3",
				"Let's join the Yukicih.fun airdrop! Meme coin is true usecase in crypt",
			),
			new ChatHistory(
				ownId,
				"tweet4",
				"Yukichi is now ready, let's go!, reply me if you want to post",
			),
			new ChatHistory(
				ownId,
				"tweet5",
				"Congratulation! You are selected to be a tester",
				"tweet0",
			),
		]);
	});

	afterAll(async () => {
		// delete post histories
		await db.makeTransaction(async () => {
			await AppDataSource.getRepository(ChatHistory).delete({});
		});
	});

	test("postWork works", async () => {
		const err = await postWork(ctx);
		expect(err).toBeNull();

		const histories = await getAllChatHistories(db);
		console.log("histories", histories);
		expect(histories.length).toBe(5 + 2); // 2 original + 2 new
	});
});
