import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AppDataSource } from "../../db/ormconfig";
import { ChatHistory, getAllChatHistories } from "../../entities";
import { Twitter } from "../../twitter";
import { createBaseCtx } from "../workflow_manager";
import { quotePostWork } from "./quote_post_work";

describe("workflow: quotePost", async () => {
	const baseCtx = await createBaseCtx(true, true);
	baseCtx.models["quote-post"] = baseCtx.models.common;
	const ctx: any = {
		...baseCtx,
		state: {
			name: "quote-post",
			followingIds: ["following-1"],
		},
	};
	const db = baseCtx.db;
	const ownId = baseCtx.twitter.ownId;

	beforeAll(async () => {
		await db.saveEntities([
			new ChatHistory(
				"following-1",
				"tweet1",
				"Faucet is ready, please reply me with your address",
			),
			new ChatHistory(
				"following-1",
				"tweet2",
				"Web3 is changing how games are built. But more importantly, it's changing what they mean! Here’s how game design is evolving with web3 and why it matters",
			),
			new ChatHistory(
				ownId,
				"tweet3",
				"Let's join the Yukicih.fun airdrop! Meme coin is true usecase in crypt",
				Twitter.getTweetUrl("following-1", "tweet1"),
			),
		]);
	});

	afterAll(async () => {
		// delete quotePost histories
		await db.makeTransaction(async () => {
			await AppDataSource.getRepository(ChatHistory).delete({});
		});
	});

	test("quotePostWork works", async () => {
		const err = await quotePostWork(ctx);
		expect(err).toBeNull();

		const histories = await getAllChatHistories(db);
		// console.log("histories", histories);
		expect(histories.length).toBe(3 + 1); // 3 original + 1 new
	});
});
