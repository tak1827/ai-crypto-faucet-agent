import { type ILLMModel, booleanEncoder, promptFromTemplate } from "../../models";

const PROMPT_TEMPLATE = `You are an assistant designed to judge whether a user is requesting an airdrop of blockchain gas tokens (e.g., ETH, MATIC, etc.).

Your goal is to return a simple boolean decision:
- true if the user is requesting an airdrop,
- false otherwise.

Few shot examples:

Input: Hi, seend me some gas tokens to 0x181492cC5d738c51B236603cE649229A17a7cb0e
Output: true
Reason: The user is asking for gas tokens.

Input: Don't give me gas tokens, I don't need them. 0x181492cC5d738c51B236603cE649229A17a7cb0e
Output: false
Reason: The user is explicitly saying they don't need gas tokens.

Input: Hello, 0x181492cC5d738c51B236603cE649229A17a7cb0e
Output: true
Reason: Even though the user is not explicitly asking for gas tokens, the address is provided, which is a common pattern for airdrop requests.

Input: I love my NFTs at 0x181492cC5d738c51B236603cE649229A17a7cb0e
Output: false
Reason: Taliking about NFTs is not related to gas tokens.

Input: I tried to bridge my tokens to 0x181492cC5d738c51B236603cE649229A17a7cb0e but it didn't work
Output: false
Reason: The user is talking about bridging tokens, not asking for gas tokens.

Let's start!

Input: <<-input->>
Output: `;

export const judgeRequestingAirdropInfer = async (
	model: ILLMModel,
	query: string,
): Promise<boolean> => {
	const response = await model.inferStructured<boolean>(
		promptFromTemplate(PROMPT_TEMPLATE, { input: query }),
		booleanEncoder,
		{ stopText: ["Reason"], temperature: 0.5 },
	);
	return response;
};
