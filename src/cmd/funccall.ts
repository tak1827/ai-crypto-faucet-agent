import { type ChatSessionModelFunctions, defineChatSessionFunction } from "node-llama-cpp";
import { createInitalizedModel } from "../models";
import logger from "../utils/logger";

async function main() {
	const model = await createInitalizedModel();

	const fruitPrices: Record<string, string> = {
		apple: "$6",
		banana: "$4",
	};
	const functions: ChatSessionModelFunctions = {
		getFruitPrice: defineChatSessionFunction({
			description: "Get the price of a fruit",
			params: {
				type: "object",
				properties: {
					name: {
						type: "string",
					},
				},
			},
			async handler(params) {
				const name = params.name.toLowerCase();
				if (Object.keys(fruitPrices).includes(name))
					return {
						name: name,
						price: fruitPrices[name],
					};

				return `Unrecognized fruit "${params.name}"`;
			},
		}),
	};

	const q1 = "Is an apple more expensive than a banana?";
	console.log(`User: ${q1}`);

	const a1 = await model.infer(q1, { functions });
	console.log(`AI: ${a1}`);
}

main().catch((err) => logger.error(err));
