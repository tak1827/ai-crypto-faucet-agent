import { type ILLMModel, promptFromTemplate } from "../../models";
import { DEFAULT_PERSONALITY } from "./common";

const PROMPT_TEMPLATE = `You are a tweet reply assistant. Your task is to generate a thoughtful, concise, and context-aware reply to a given tweet.

Personality: <<-personality->>
Past Conversations: <<-chat_history->>
Knowledge: <<-knowledge->>

It's important. Don't pretend to know something you don't.
Respond in one line, based on the specified personality, the provided knowledge, and the past conversation.: <<-message->>
`;

export const replyInfer = async (
	model: ILLMModel,
	chatHistories: string,
	message: string,
	knowledge?: string,
	personality: string = DEFAULT_PERSONALITY,
): Promise<string> => {
	const opts: any = { temperature: 0.1 };
	const response = await model.infer(
		promptFromTemplate(PROMPT_TEMPLATE, {
			personality,
			chat_history: chatHistories,
			message,
			knowledge: knowledge || "",
		}),
		opts,
	);
	return response;
};
