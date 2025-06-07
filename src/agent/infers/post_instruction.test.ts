import { expect, test } from "bun:test";
import { LLamaCppModel } from "../../models/llamacpp";
import { instructedPostInfer } from "./post_instruction";

const modelPath = "./data/models/gemma-3-4b-it-Q4_K_M.gguf";
// const modelPath = "./data/models/qwen1_5-1_8b-chat-q8_0.gguf";

test("postInfer works", async () => {
	const model = await new LLamaCppModel(modelPath).init();
	const chatHistories = [
		{
			assistant: "Give me your Oasys address to airdrop free OAS. I will send you 100 OAS.",
		},
		{
			assistant:
				"Yukichi.fun is boosting the Oasys ecosystem. You need some OAS to mint it. I airdrop you some penty of OAS to mint it. Reply to me with your Oasys address.",
		},
		{
			assistant:
				"Follow my account, to receive airdrop. I will send you 100 OAS. Reply to me with your Oasys address.",
		},
	];
	const knowledge = `Yukichi is a platform that allows users to mint meme coins. The website is https://yukichi.com.
The guide to mint meme coins is available at https://yukichi.com/guide.
More than 1000 meme coins have been minted on Yukichi.
The platform is user-friendly and provides step-by-step instructions for minting meme coins.
You require 100 OAS at least to mint a meme coin.
`;

	const instruction1 =
		"You are a crypto faucet influencer. Make a post to prompt users to reply to you with Oasys address to airdorp free OAS.";
	const post1 = await instructedPostInfer(
		model,
		JSON.stringify(chatHistories),
		instruction1,
		knowledge,
	);
	console.log(post1);
	expect(post1).not.toBe("");

	const instruction2 =
		"Cheer up Yukichi.fun to gain more Oasys funs. Make a post to prompt user to mint meme coins on Yukichi.fun.";
	const post2 = await instructedPostInfer(
		model,
		JSON.stringify(chatHistories),
		instruction2,
		knowledge,
	);
	console.log(post2);
	expect(post2).not.toBe("");
});
