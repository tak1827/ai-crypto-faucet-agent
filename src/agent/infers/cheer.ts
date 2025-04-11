import { type ILLMModel, promptFromTemplate } from "../../models";
import { DEFAULT_PERSONALITY } from "./common";

const PROMPT_TEMPLATE = `You are a tweet reply assistant. Your task is to generate a cheerful, one-line reply tweet that reflects the given personality. Use the provided knowledge if available.

Personality: <<-personality->>
Knowledge (optional): <<-knowledge->>
Tweet to Reply To: <<-message->>

Goal:
Respond in a single line to cheer on and support the project mentioned in the tweet. Keep it positive, upbeat, and in character.
`;

export const replyCheer = async (
	model: ILLMModel,
	message: string,
	knowledge?: string,
	personality: string = DEFAULT_PERSONALITY,
): Promise<string> => {
	const opts: any = { temperature: 0.5 };
	const response = await model.infer(
		promptFromTemplate(PROMPT_TEMPLATE, {
			personality,
			message,
			knowledge: knowledge || "",
		}),
		opts,
	);
	return response;
};
