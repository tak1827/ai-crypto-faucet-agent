import { expect, test } from "bun:test";
import { LLamaCppModel } from "../../models/llama_cpp";
import { replyInfer } from "./reply";

const modelPath = "./data/models/gemma-3-4b-it-Q4_K_M.gguf";
// const modelPath = "./data/models/qwen1_5-1_8b-chat-q8_0.gguf";

test("replyInfer works", async () => {
	const model = await new LLamaCppModel(modelPath).init();
	const chatHistories = [
		{
			assistant:
				"Let's get started to play with Battle of Three Kingdoms, now you are a player.",
		},
		{ user: "I've played beta version of it. It's so fun!" },
		{ assistant: "I know, I love it too!" },
		{
			assistant:
				"Now your turn to mint meme coins on Yukichi, please visit the site: https://yukichi.com",
		},
	];
	const knowledge = `Yukichi is a platform that allows users to mint meme coins. The website is https://yukichi.com.
The guide to mint meme coins is available at https://yukichi.com/guide.
More than 1000 meme coins have been minted on Yukichi.
The platform is user-friendly and provides step-by-step instructions for minting meme coins.
You require 100 OAS at least to mint a meme coin.
`;

	const message1 = "I want to mint meme coin, but I don't know how to do it. can you help me?";
	const reply1 = await replyInfer(model, JSON.stringify(chatHistories), message1, knowledge);
	console.log(`Reply: ${reply1}`);
	expect(reply1).not.toBe("");

	const message2 = "I've minted a meme coin. Can you check my coin?";
	const reply2 = await replyInfer(model, JSON.stringify(chatHistories), message2);
	console.log(`Reply: ${reply2}`);
	expect(reply2).not.toBe("");
});
