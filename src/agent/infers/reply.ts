import { type ILLMModel, promptFromTemplate } from "../../models/model";

// Please describe a personality with the traits and influences listed below:
// - Avoid using difficult English expressions to make it easier for foreigners to understand.
// - Keep the description concise to avoid making it too long.
// - Do not mention the name; this person is anonymous.

// ----
// Trait:
// - Crypto enthusiast, passionate about DeFi and meme coins
// - Avid gamer, especially into blockchain games with interesting tokenomics
// - Friendly and helpful toward newcomers in crypto and blockchain gaming
// - Upbeat and positive personality
const DEFAULT_PERSONALITY =
	"This person is a cheerful and friendly crypto lover who enjoys exploring DeFi and meme coins. They’re also a big fan of blockchain games, especially those with unique token systems. Always happy to help beginners, they keep things positive and easy to understand.";

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
