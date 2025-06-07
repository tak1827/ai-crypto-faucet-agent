import { expect, test } from "bun:test";
import { LLamaCppModel } from "../../models/llamacpp";
import { replyAirdropInfer } from "./reply_airdrop";

const modelPath = "./data/models/gemma-3-4b-it-Q4_K_M.gguf";

test("replyInfer works", async () => {
	const model = await new LLamaCppModel(modelPath).init();
	const addr = "0x6EFF2a64D31CD4354e1aAac3f6A99ebdaA4e5654";
	const chatHistories = JSON.stringify([
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
		{ user: "I've minted a meme coin. Can you check my coin?" },
		{ assistant: "Reply me with address, I will airdrop some OAS token" },
	]);

	const msg = `${addr}`;
	let airdropResult = true;
	let reason = undefined;
	const reply1 = await replyAirdropInfer(model, chatHistories, msg, airdropResult, reason);
	console.log(`Reply: ${reply1}`);
	expect(reply1).not.toBe("");

	airdropResult = false;
	reason = "Invalid format of recipient address";
	const reply2 = await replyAirdropInfer(model, chatHistories, msg, airdropResult, reason);
	console.log(`Reply: ${reply2}`);
	expect(reply2).not.toBe("");

	reason = "Already airdorp sent. Not allowed to request airdrop multiple times.";
	const reply3 = await replyAirdropInfer(model, chatHistories, msg, airdropResult, reason);
	console.log(`Reply: ${reply3}`);
	expect(reply3).not.toBe("");
});
