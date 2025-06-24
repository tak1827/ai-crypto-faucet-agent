import { defineChatSessionFunction, type ChatSessionModelFunction } from "node-llama-cpp";
import type { Database } from "../../db";
import type { ILLMModel } from "../../models";
import { searchWeb } from "./search_web";

export class AgentTool {
    readonly llm: ILLMModel;
    readonly db: Database;

    constructor(llm: ILLMModel, db: Database) {
        this.llm = llm;
        this.db = db;
    }

    /**
     * Chat session function that performs a web search and returns the summary.
     */
    webSearch(): ChatSessionModelFunction<{
        type: "object";
        properties: {
            query: { type: "string" };
            needShortSummary?: { type: "boolean" };
            saveToDB?: { type: "boolean" };
        };
        required: ["query"];
    }> {
        return defineChatSessionFunction({
            description: "Search the web using Google Custom Search and summarize the results.",
            params: {
                type: "object",
                properties: {
                    query: { type: "string" },
                    needShortSummary: { type: "boolean" },
                    saveToDB: { type: "boolean" },
                },
                required: ["query"],
            },
            handler: async ({ query, needShortSummary, saveToDB }) => {
                return await searchWeb(this.llm, this.db, query, {
                    needShortSummary,
                    saveToDB,
                });
            },
        });
    }
}
