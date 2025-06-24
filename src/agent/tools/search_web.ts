import { DocumentChunk, DocumentCore } from "../../entities";
import type { ILLMModel } from "../../models";
import { googleCustomSearch } from "../../utils/search_google";

export async function searchWeb(
	model: ILLMModel,
	query: string,
): Promise<{
	result: string;
	shortSummary: string;
	documentCore: DocumentCore;
	documentChunks: DocumentChunk[];
}> {
	const response = await googleCustomSearch(query, { num: 5 });
	const items = response.items ?? [];

	// Concatenate search results into a single text
	const rawText = items
		.map((item) => `${item.title}\n${item.link}\n${item.snippet}`)
		.join("\n");

	// Ask model to format into a coherent paragraph
	const result = await model.infer(
		`Please rewrite the following search results into a single coherent text.\n${rawText}`,
	);

	// Create document entities
	const documentCore = new DocumentCore(query);
	documentCore.content = result;

	const documentChunk = new DocumentChunk(model.name(), result, documentCore);
	const embedding = await model.embed(result);
	documentChunk.embedding = `[${embedding.join(",")}]`;

	let shortSummary = "";
	try {
		shortSummary = await model.infer(
			`Summarize the following text in one short sentence.\n${result}`,
		);
	} catch {
		shortSummary = "";
	}

	return {
		result,
		shortSummary,
		documentCore,
		documentChunks: [documentChunk],
	};
}
