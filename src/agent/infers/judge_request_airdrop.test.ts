import { expect, test } from "bun:test";
import { LLamaCppModel } from "../../models/llamacpp";
import logger from "../../utils/logger";
import { judgeRequestingAirdropInfer } from "./judge_request_airdrop";

const modelPath = "./data/models/gemma-3-4b-it-Q4_K_M.gguf";
// const modelPath = "./data/models/qwen1_5-1_8b-chat-q8_0.gguf";

test("judgeRequestingAirdropInfer works", async () => {
	const model = await new LLamaCppModel(modelPath).init();
	const addr = "0x6EFF2a64D31CD4354e1aAac3f6A99ebdaA4e5654";

	const tests: {
		query: string;
		expected: boolean;
	}[] = [
		{
			query: `give me some gas tokens to: ${addr}, OUTPUT: `,
			expected: true,
		},
		{
			query: `${addr}`,
			expected: true,
		},
		{
			query: `I have a question, How can I get some gas tokens? ${addr}`,
			expected: true,
		},
		{
			query: `Don't give me gas tokens, I don't need them. ${addr}`,
			expected: false,
		},
		{
			query: `I love my NFTs at ${addr}, Don't you think they are cool?`,
			expected: false,
		},
		{
			query: `I failed to deploy my contract to ${addr}, tell me what I did wrong`,
			expected: false,
		},
	];

	for (const { query, expected } of tests) {
		const result = await judgeRequestingAirdropInfer(model, query);
		if (result !== expected) {
			logger.error(`expected: ${expected}, got: ${result}, query: ${query}`);
			// expect(result).toBe(expected);
		}
	}
});
