import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ChatHistory, DocumentChunk, DocumentCore } from "../entities";
import { LLamaCppModel } from "../models/llamacpp";
import { Env } from "../utils/env";
import { Database } from "./index";
import { AppDataSource } from "./ormconfig";

describe("db: vectorSearch/vectorSearchTables", async () => {
	const db = await new Database(AppDataSource).init();
	const emodel = await new LLamaCppModel(Env.path("LLM_EMBEDDING_MODEL_PATH")).init();
	const filter = { meta: "traget" };

	beforeAll(async () => {
		// save chats
		const texts = [
			"I love programming in JavaScript.",
			"This is a test tweet with some text to embed.",
			"The wether news is not accurate.",
			"The weather is nice today.",
			"Tokyo is sunny today.",
		];
		const chats = [];
		for (let i = 0; i < texts.length; i++) {
			const chat = new ChatHistory("ownId", `tweet-${i}`, texts[i]);
			const embeds = await emodel.embed(texts[i] || "");
			chat.embedding = `[${embeds.join(",")}]`;
			chats.push(chat);
		}
		chats.push(new ChatHistory("ownId", "tweet-5", "No embedding for this tweet"));
		await db.saveEntities(chats);

		// save documents
		const chunks = [];
		const docCore = new DocumentCore("filename");
		for (let i = 0; i < texts.length; i++) {
			const docChunk = new DocumentChunk(`model-${i}`, texts[i] || "", docCore, filter);
			docChunk.embedding = chats[i]?.embedding || "";
			chunks.push(docChunk);
		}
		if (chunks[2]) chunks[2].metadata = { meta2: "not-target" };
		if (chunks[4]) chunks[4].metadata = { meta: "not-target" };
		chunks.push(new DocumentChunk("model-5", "No embedding for this document", docCore));
		await db.saveEntities(chunks);
	});

	afterAll(async () => {
		await db.makeTransaction(async () => {
			await AppDataSource.getRepository(ChatHistory).delete({});
			await AppDataSource.getRepository(DocumentCore).delete({});
			await AppDataSource.getRepository(DocumentChunk).delete({});
		});
	});

	test("vectorSearch: works", async () => {
		const query = "Tell me about the weather in Tokyo";
		const queryEmbeds = await emodel.embed(query);
		const results = await db.vectorSearch<ChatHistory[]>(
			"chat_history",
			"embedding",
			queryEmbeds,
			3,
		);
		// print each result
		for (const result of results) {
			console.log(`Result: ${result.content}, Distance: ${result._distance}`);
		}
		expect(results.length).toBe(3);
		expect(results[0]?.externalId).toBe(`tweet-${4}`);
		expect(results[1]?.externalId).toBe(`tweet-${3}`);
		expect(results[2]?.externalId).toBe(`tweet-${2}`);

		// Find the tweet with no embedding
		await db.makeQuery(async (queryRunner) => {
			const row = await queryRunner.manager.findOne(ChatHistory, {
				where: { embedding: ChatHistory.zeroEmbedding() },
			});
			expect(row).toBeDefined();
			expect(row?.externalId).toBe("tweet-5");
		});
	});

	test("vectorSearch: with filter", async () => {
		const query = "Tell me about the weather in Tokyo";
		const queryEmbeds = await emodel.embed(query);
		const results = await db.vectorSearch<DocumentChunk[]>(
			"document_chunk",
			"embedding",
			queryEmbeds,
			3,
			filter,
		);
		// print each result
		for (const result of results) {
			console.log(
				`Result: ${result.chunk}, Distance: ${result._distance}, name: ${result.model}`,
			);
		}
		expect(results.length).toBe(3);
		expect(results[0]?.model).toBe(`model-${3}`);
		expect(results[1]?.model).toBe(`model-${1}`);
		expect(results[2]?.model).toBe(`model-${0}`);
	});

	test("vectorSearchTables: works", async () => {
		const query = "Tell me about the weather in Tokyo";
		const queryEmbeds = await emodel.embed(query);
		const results = await db.vectorSearchTables(
			[
				{ tableName: "chat_history", textCol: "content" },
				{ tableName: "document_chunk", textCol: "chunk" },
			],
			queryEmbeds,
			3,
		);
		// print each result
		for (const result of results) {
			console.log(`Result: ${result.id}, Distance: ${result._distance}, text: ${result.text}`);
		}
		expect(results.length).toBe(3);
		expect(results[0]?.text).toBe("Tokyo is sunny today.");
		expect(results[1]?.text).toBe("Tokyo is sunny today.");
		expect(results[2]?.text).toBe("The weather is nice today.");
	});
});
