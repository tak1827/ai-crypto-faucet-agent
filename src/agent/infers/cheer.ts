import { type ILLMModel, promptFromTemplate } from "../../models";
import { DEFAULT_PERSONALITY } from "./common";

const PROMPT_TEMPLATE = `You are a tweet reply assistant. Your task is to generate a reply tweet that reflects the given personality. Use the provided knowledge if available.

Personality: <<-personality->>
Knowledge (optional): <<-knowledge->>
Tweet to Reply To: <<-message->>
Respond without preamble: `;

export const replyCheer = async (
	model: ILLMModel,
	message: string,
	knowledge?: string,
	personality: string = DEFAULT_PERSONALITY,
): Promise<string> => {
	const opts: any = { temperature: 0.7 };
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
