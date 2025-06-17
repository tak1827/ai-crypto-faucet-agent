import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "../../db";
import { AppDataSource } from "../../db/ormconfig";
import { ChatHistory, getAllChatHistories } from "../../entities";
import { LLamaCppModel } from "../../models/llamacpp";
import { Env } from "../../utils/env";
import type { BaseWorkflowContext } from "../workflow_manager";
import { embeddingWork } from "./embedding_work";

describe("workflow: embedding", async () => {
	const db = await new Database(AppDataSource).init();
	const embed = await new LLamaCppModel(Env.path("LLM_EMBEDDING_MODEL_PATH")).init();
	const baseCtx = {
		db,
		models: { embed },
	} as any as BaseWorkflowContext;
	const ctx: any = {
		...baseCtx,
		state: {
			name: "embedding",
		},
	};
	const ownId = "ownId123";

	beforeAll(async () => {
		const chat1 = new ChatHistory(ownId, "tweet1", "has embedding");
		chat1.embedding = "[-2.2453473,9.105969,-0.25578472,3.3939383]";
		await db.saveEntities([
			chat1,
			new ChatHistory(ownId, "tweet2", "hello world"),
			new ChatHistory(ownId, "tweet3", "another tweet"),
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
		expect(histories.length).toBe(3);
		for (const h of histories) {
			expect(h.embedding).not.toBeNull();
		}
	});
});
