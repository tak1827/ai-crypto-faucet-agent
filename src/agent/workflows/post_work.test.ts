import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AppDataSource } from "../../db/ormconfig";
import { ChatHistory, getAllChatHistories } from "../../entities";
import { createBaseCtx } from "../workflow_manager";
import { postWork } from "./post_work";

describe("workflow: post", async () => {
	const baseCtx = await createBaseCtx(true);
	baseCtx.models.post = baseCtx.models.common;
	const ctx: any = {
		...baseCtx,
		state: {
			name: "post",
			instructions: [
				"Airdrop OAS to followers to cheer up Oasys Ecosystem. Prompt user to reply with their address",
				"Cheer up Yukichi.fun to achieve more than 1000 meme tokens to be issued in a week after the launch",
			],
		},
	};
	const db = baseCtx.db;
	const ownId = baseCtx.twitter.ownId;

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
		// console.log("histories", histories);
		expect(histories.length).toBe(5 + 2); // 2 original + 2 new
	});
});
