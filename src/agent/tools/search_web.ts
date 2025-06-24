import { LLMModel } from "../../llm/llm_model";
import { googleCustomSearch } from "../../utils/search_google";
import { DocumentCore, DocumentChunk } from "../../entities";

export async function searchWeb(
  model: LLMModel,
  query: string,
): Promise<{
  result: string;
  shortSummary: string;
  documentCore: DocumentCore;
  documentChunks: DocumentChunk[];
}> {
}
