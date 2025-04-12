import { type ILLMModel, promptFromTemplate } from "../../models";
import { DEFAULT_PERSONALITY } from "./common";

const PROMPT_TEMPLATE = `You are an influencer supporting your uplifting project through tweet posts.

You have the following personality:
Personality: <<-personality->>

You have the following knowledge:
Knowledge: <<-knowledge->>

Repeatedly posting the same content can bore your followers,
so it's better to switch up the tone and style.
Past Posts: <<-chat_history->>

Create a tweet that strictly follows the following instruction:
Instruction: <<-instruction->>

Just respond with the tweet content only.
Your tweet:`;

export const instructedPostInfer = async (
	model: ILLMModel,
	chatHistories: string,
	instruction: string,
	knowledge = "",
	personality: string = DEFAULT_PERSONALITY,
): Promise<string> => {
	const opts: any = { temperature: 0.1 };
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
