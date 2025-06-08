import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { ILLMModel } from ".";
import { Env } from "../utils/env";
import { LlamaCppClient } from "./llamacpp_client";
import { LlamaCppServer } from "./llamacpp_server";

describe("LlamaCppServer", async () => {
	let server: LlamaCppServer;
	let client: ILLMModel;
	beforeAll(async () => {
		const host = Env.string("LLM_SERVER_HOST");
		const port = Env.number("LLM_SERVER_PORT");
		const token = Env.string("LLM_SERVER_TOKEN");
		server = new LlamaCppServer(host, port, token);
		client = new LlamaCppClient(host, port, token);
		await server.start();
	});

	afterAll(async () => {
		await client.close();
		await server.close();
	});

	test("embedding", async () => {
		const emb = await client.embed("hello");
		expect(emb.length).toBe(Env.number("EMBEDDING_DIMENSION"));
	});

	test("infer", async () => {
		try {
			const result = await client.infer("Can you tell me a joke?", { temperature: 0.7 });
			expect(result).toBeDefined();
		} catch (err) {
			expect(err).toBeUndefined();
		}
	});
});
