import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AppDataSource } from "../../db/ormconfig";
import { ChatHistory, getAllChatHistories } from "../../entities";
import { createBaseCtx } from "../workflow_manager";
import { embeddingWork } from "./embedding_work";

describe("workflow: embedding", async () => {
	const baseCtx = await createBaseCtx(true, true);
	baseCtx.models.embedding = baseCtx.models.common;
	const ctx: any = {
		...baseCtx,
		state: {
			name: "embedding",
		},
	};
	const db = baseCtx.db;
	const ownId = baseCtx.twitter.ownId;

	beforeAll(async () => {
		await db.saveEntities([
			new ChatHistory(ownId, "tweet1", "hello world"),
			new ChatHistory(ownId, "tweet2", "another tweet"),
		]);
	});

	afterAll(async () => {
		await db.makeTransaction(async () => {
			await AppDataSource.getRepository(ChatHistory).delete({});
		});
	});

	test("embeddingWork works", async () => {
		const err = await embeddingWork(ctx);
		expect(err).toBeNull();

		const histories = await getAllChatHistories(db);
		expect(histories.length).toBe(2);
		for (const h of histories) {
			expect(h.embedding).not.toBeNull();
		}
	});
});
