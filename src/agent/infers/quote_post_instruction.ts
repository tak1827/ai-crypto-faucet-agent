import { type ILLMModel, promptFromTemplate } from "../../models";
import { DEFAULT_PERSONALITY } from "./common";

const PROMPT_TEMPLATE = `You are an influencer. Engage your followers by sharing your opinion on a tweet from an account you follow.

You have the following personality:
Personality: <<-personality->>

You have the following knowledge:
Knowledge: <<-knowledge->>

Tweet you’re responding to:
Quoted post: <<-quoting->>

Write a few sentences with a combined total of no more than 250 characters.
Start without any preamble: `;

export const instructedQuotePostInfer = async (
	model: ILLMModel,
	quoting: string,
	knowledge = "",
	personality: string = DEFAULT_PERSONALITY,
): Promise<string> => {
	const opts: any = { temperature: 0.8 };
	const response = await model.infer(
		promptFromTemplate(PROMPT_TEMPLATE, {
			personality,
			quoting,
			knowledge,
		}),
		opts,
	);
	return response;
};
