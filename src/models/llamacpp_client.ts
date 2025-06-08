import { Env } from "../utils/env";
import type { Embedder, ILLMModel } from ".";

export class LlamaCppClient implements ILLMModel {
	readonly baseUrl: string;
	readonly token: string;

	constructor(host: string, port: number, token: string) {
		this.baseUrl = `http://${host}:${port}`;
		this.token = token;
	}

	static fromEnv(): LlamaCppClient {
		const host = Env.string("LLM_SERVER_HOST");
		const port = Env.number("LLM_SERVER_PORT");
		const token = Env.string("LLM_SERVER_TOKEN");
		return new LlamaCppClient(host, port, token);
	}

	async init(): Promise<ILLMModel> {
		return this;
	}

	async close(): Promise<void> {
		return;
	}

	name(): string {
		return "llama-cpp-client";
	}

	async infer(
		query: string,
		opt?: { temperature?: number; stopText?: string[] },
	): Promise<string> {
		const body: Record<string, unknown> = { prompt: query };
		if (opt?.temperature !== undefined) body.temperature = opt.temperature;
		if (opt?.stopText !== undefined) body.stopText = opt.stopText;

		const res = await fetch(`${this.baseUrl}/infer`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.token}`,
			},
			body: JSON.stringify(body),
		});

		if (!res.ok || !res.body) {
			throw new Error(`infer failed: ${res.status} ${await res.text()}`);
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let result = "";
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			const chunk = decoder.decode(value, { stream: true });
			for (const part of chunk.split("\n\n")) {
				const trimmed = part.trim();
				if (trimmed.startsWith("data:")) {
					const data = trimmed.slice(5).trim();
					if (data === "[EOF]") return result;
					result += data;
				}
			}
		}
		return result;
	}

	async inferStructured<T>(
		query: string,
		encode: (response: string) => T,
		opt?: { temperature?: number; stopText?: string[] },
	): Promise<T> {
		const res = await this.infer(query, opt);
		return encode(res);
	}

	async embed(text: string): Promise<readonly number[]> {
		const res = await fetch(`${this.baseUrl}/embedding`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.token}`,
			},
			body: JSON.stringify({ text }),
		});

		if (!res.ok) {
			throw new Error(`embedding failed: ${res.status} ${await res.text()}`);
		}
		const data = (await res.json()) as { embedding: number[] };
		return data.embedding;
	}

	async embedContext(task: (_embedder: Embedder) => Promise<void>): Promise<void> {
		await task(async (text: string) => await this.embed(text));
	}
}
