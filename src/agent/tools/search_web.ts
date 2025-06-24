import { googleCustomSearch } from "../../utils/search_google";
import { DocumentCore, DocumentChunk } from "../../entities";

export async function searchWeb(query: string): Promise<{
  result: string;
  shortSummary: string;
  documentCore: DocumentCore;
  documentChunks: DocumentChunk[];
}> {
}
