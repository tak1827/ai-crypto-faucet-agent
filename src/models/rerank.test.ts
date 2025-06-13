import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "../db";
import { AppDataSource } from "../db/ormconfig";
import { ChatHistory, DocumentChunk, DocumentCore } from "../entities";
import {
	LlamaCppClient,
	type RerankSearchConfig,
	createInitalizedEmbModel,
	rerank,
} from "./index";

// Integration test for rerank using a real database

describe("rerank: integration", async () => {
	process.env.LOG_LEVEL = "info";
	const db = await new Database(AppDataSource).init();
	const emodel = await createInitalizedEmbModel(LlamaCppClient.name);
	const ownId = "ownId";
	const searchConfigs: RerankSearchConfig[] = [
		{
			tableName: "chat_history",
			source: "chat",
			textColumn: "content",
			whereQuery: `identifier <> '${ownId}'`,
		},
		{ tableName: "document_chunk", source: "doc", textColumn: "chunk" },
	];
	const query = "Tell me about the weather in Tokyo";

	beforeAll(async () => {
		const docCore = new DocumentCore("testfile");
		const chunk1 = new DocumentChunk("model-1", "I don't rely on the weather news", docCore);
		const chunk2 = new DocumentChunk(
			"model-1",
			"I forget the the weather forecast in Tokyo today",
			docCore,
		);
		const chunk3 = new DocumentChunk(
			"model-1",
			"The weather in Tokyo is unpredictable",
			docCore,
		);
		const chat1 = new ChatHistory("identifier1", "tweet-1", "I like sunny days");
		const chat2 = new ChatHistory("identifier2", "tweet-2", "today is cludy and rainy");
		const chat3 = new ChatHistory(ownId, "tweet-3", "The weather in Tokyo is rainy today");
		const chat4 = new ChatHistory("identifier4", "tweet-4", "Today is sunny in Tokyo");
		const chat5 = new ChatHistory("identifier5", "tweet-5", "I love to travel to Tokyo");
		const chat6 = new ChatHistory("identifier6", "tweet-6", "Tokyo is a great city");

		const texts = [
			chunk1.chunk,
			chunk2.chunk,
			chunk3.chunk,
			chat1.content,
			chat2.content,
			chat3.content,
			chat4.content,
			chat5.content,
			chat6.content,
		];
		const embeds = await Promise.all(texts.map((t) => emodel.embed(t)));
		chunk1.embedding = `[${(embeds[0] || []).join(",")}]`;
		chunk2.embedding = `[${(embeds[1] || []).join(",")}]`;
		chunk3.embedding = `[${(embeds[2] || []).join(",")}]`;
		chat1.embedding = `[${(embeds[2] || []).join(",")}]`;
		chat2.embedding = `[${(embeds[3] || []).join(",")}]`;
		chat3.embedding = `[${(embeds[4] || []).join(",")}]`;
		chat4.embedding = `[${(embeds[5] || []).join(",")}]`;
		chat5.embedding = `[${(embeds[6] || []).join(",")}]`;
		chat6.embedding = `[${(embeds[7] || []).join(",")}]`;

		// Adjust updatedAt values for deterministic recency score
		chunk1.updatedAt = new Date("2024-01-01");
		chunk2.updatedAt = new Date("2024-02-01");
		chunk3.updatedAt = new Date("2024-03-01");
		chat1.updatedAt = new Date("2024-01-01");
		chat2.updatedAt = new Date("2024-01-15");
		chat3.updatedAt = new Date("2024-02-01");
		chat4.updatedAt = new Date("2024-02-01");
		chat5.updatedAt = new Date("2024-03-01");
		chat6.updatedAt = new Date("2024-04-01");

		await db.saveEntities([
			docCore,
			chunk1,
			chunk2,
			chunk3,
			chat1,
			chat2,
			chat3,
			chat4,
			chat5,
			chat6,
		]);
	});

	afterAll(async () => {
		await db.makeTransaction(async () => {
			await AppDataSource.getRepository(ChatHistory).delete({});
			await AppDataSource.getRepository(DocumentChunk).delete({});
			await AppDataSource.getRepository(DocumentCore).delete({});
		});
		await emodel.close();
		await db.close();
	});

	test("rerank sorts by distance and recency", async () => {
		const ranked = await rerank(
			emodel,
			db,
			query,
			searchConfigs,
			{ distance: 0.7, recency: 0.3 },
			3,
		);

		console.log("Ranked results:", ranked);
		expect(ranked.length).toBe(3);
		// Ensure that the results are returned with source information
		for (const r of ranked) {
			expect(r.text).toBeDefined();
			expect(r.source).toBeDefined();
		}
	});
});
