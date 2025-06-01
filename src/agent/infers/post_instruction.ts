import { type ILLMModel, promptFromTemplate } from "../../models";
import { DEFAULT_PERSONALITY } from "./common";

const PROMPT_TEMPLATE = `You are an influencer supporting your uplifting project through tweet posts.

You have the following personality:
Personality: <<-personality->>

You have the following knowledge:
Knowledge: <<-knowledge->>

Never post the same content you’ve shared before.
Past Posts: <<-chat_history->>

Create a tweet that strictly follows the following instruction:
Instruction: <<-instruction->>

Write a few sentences with a combined total of no more than 250 characters.
Start without any preamble: `;

export const instructedPostInfer = async (
	model: ILLMModel,
	chatHistories: string,
	instruction: string,
	knowledge = "",
	personality: string = DEFAULT_PERSONALITY,
): Promise<string> => {
	const opts: any = { temperature: 0.8 };
	const response = await model.infer(
		promptFromTemplate(PROMPT_TEMPLATE, {
			personality,
			chat_history: chatHistories,
			instruction,
			knowledge,
		}),
		opts,
	);
	return response;
};
