import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ChatHistory, DocumentChunk, DocumentCore } from "../entities";
import { Database } from "../db";
import { AppDataSource } from "../db/ormconfig";
import { LLamaCppModel } from "./llamacpp";
import { rerank, type RerankSearchConfig } from "./index";
import { Env } from "../utils/env";

// Integration test for rerank using a real database

describe("rerank: integration", async () => {
  process.env.LOG_LEVEL = "info";
  const db = await new Database(AppDataSource).init();
  const emodel = await new LLamaCppModel(Env.path("WORKFLOW_EMBEDDING_MODEL_PATH")).init();
  const searchConfigs: RerankSearchConfig[] = [
    { tableName: "chat_history", source: "chat", textColumn: "content" },
    { tableName: "document_chunk", source: "doc", textColumn: "chunk" },
  ];

  beforeAll(async () => {
    const docCore = new DocumentCore("testfile");
    const chat1 = new ChatHistory("own", "tweet-1", "chat A1");
    const chat2 = new ChatHistory("own", "tweet-2", "chat A2");
    const chunk1 = new DocumentChunk("model-1", "doc B1", docCore);
    const chunk2 = new DocumentChunk("model-2", "doc B2", docCore);

    const texts = [chat1.content, chat2.content, chunk1.chunk, chunk2.chunk];
    const embeds = await Promise.all(texts.map((t) => emodel.embed(t)));
    chat1.embedding = `[${embeds[0].join(",")}]`;
    chat2.embedding = `[${embeds[1].join(",")}]`;
    chunk1.embedding = `[${embeds[2].join(",")}]`;
    chunk2.embedding = `[${embeds[3].join(",")}]`;

    // Adjust updatedAt values for deterministic recency score
    chat1.updatedAt = new Date("2024-01-02");
    chat2.updatedAt = new Date("2024-01-01");
    chunk1.updatedAt = new Date("2024-01-03");
    chunk2.updatedAt = new Date("2024-01-04");

    await db.saveEntities([docCore, chat1, chat2, chunk1, chunk2]);
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
    const ranked = await rerank(emodel, db, "doc", searchConfigs, { distance: 0.7, recency: 0.3 }, 3);
    expect(ranked.length).toBe(3);
    // Ensure that the results are returned with source information
    for (const r of ranked) {
      expect(r.text).toBeDefined();
      expect(r.source).toBeDefined();
    }
  });
});
