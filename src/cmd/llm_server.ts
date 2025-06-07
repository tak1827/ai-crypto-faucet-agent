import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createInitalizedEmbModel, createInitalizedModel } from "../models";
import { Env } from "../utils/env";
import logger from "../utils/logger";
import { LLamaCppModel } from "../models/llama_cpp";

async function main() {
    const host = Env.string("LLM_SERVER_HOST");
    const port = Env.number("LLM_SERVER_PORT");
    const token = Env.string("LLM_SERVER_TOKEN");
    const embedTimeout = Env.number("LLM_EMBED_TIMEOUT");

    const app = express();
    app.use(express.json());

    const inferModel = (await createInitalizedModel()) as LLamaCppModel;
    const embedModel = (await createInitalizedEmbModel()) as LLamaCppModel;

    const auth = (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers["authorization"] || "";
        if (authHeader !== `Bearer ${token}`) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        next();
    };

    app.post("/infer", auth, async (req: Request, res: Response) => {
        const { prompt } = req.body as { prompt?: string };
        if (!prompt) {
            res.status(400).json({ error: "prompt required" });
            return;
        }
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const session = inferModel.getSession("");
        try {
            await session.prompt(prompt, {
                trimWhitespaceSuffix: true,
                stopOnAbortSignal: true,
                signal: undefined,
                onTextChunk: (chunk: string) => {
                    res.write(`data: ${chunk}\n\n`);
                },
            });
            res.write("data: [DONE]\n\n");
        } catch (err) {
            logger.error(err, "infer error");
            res.write(`event: error\ndata: ${(err as Error).message}\n\n`);
        } finally {
            session.dispose();
            res.end();
        }
    });

    app.post("/embedding", auth, async (req: Request, res: Response) => {
        const { text } = req.body as { text?: string };
        if (!text) {
            res.status(400).json({ error: "text required" });
            return;
        }
        res.setTimeout(embedTimeout);
        try {
            const emb = await embedModel.embed(text);
            res.json({ embedding: emb });
        } catch (err) {
            logger.error(err, "embedding error");
            res.status(500).json({ error: (err as Error).message });
        }
    });

    const server = app.listen(port, host, () => {
        logger.info(`llm api server started on http://${host}:${port}`);
    });

    const close = async () => {
        server.close();
        await inferModel.close();
        if (embedModel !== inferModel) await embedModel.close();
        logger.info("llm api server closed");
    };
    process.on("SIGINT", close);
    process.on("SIGTERM", close);
}

main().catch((err) => logger.error(err));
