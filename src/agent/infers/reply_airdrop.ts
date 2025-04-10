import { type ILLMModel, promptFromTemplate } from "../../models";
import { DEFAULT_PERSONALITY } from "./common";

const PROMPT_TEMPLATE = `You are a tweet reply assistant. Your job is to craft a concise, context-aware response to a tweet based on the given Personality and Past Conversations.

Personality: <<-personality->>
Past Conversations: <<-chat_history->>
Airdrop Result: <<-airdrop_result->>
Failure Reason (if any): <<-airdrop_failed_reason->>
Tweet to Reply To: <<-message->>

Instructions:
- If the airdrop succeeded, reply with a warm, congratulatory message.
- If it failed, reply with a short message explaining why it failed.
- Keep the response to one line, and match the tone of the personality.

Reply in a single line, strictly adhering to the instructions.
`;

export const replyAirdropInfer = async (
	model: ILLMModel,
	chatHistories: string,
	message: string,
	airdropResult: boolean,
	airdropFailedReason?: string,
	personality: string = DEFAULT_PERSONALITY,
): Promise<string> => {
	const opts: any = { temperature: 0.1 };
	const response = await model.infer(
		promptFromTemplate(PROMPT_TEMPLATE, {
			personality,
			chat_history: chatHistories,
			message,
			airdrop_result: airdropResult ? "succeeded" : "failed",
			airdrop_failed_reason: airdropFailedReason || "",
		}),
		opts,
	);
	return response;
};
