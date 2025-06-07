import type { Server } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import { createInitalizedEmbModel, createInitalizedModel } from "./index";
import { LLamaCppModel } from "./llama_cpp";
import logger from "../utils/logger";

export class LLMServer {
    readonly host: string;
    readonly port: number;
    readonly token: string;
    readonly embedTimeout: number;
    #server?: Server;
    #inferModel?: LLamaCppModel;
    #embedModel?: LLamaCppModel;
    #closing = false;

    constructor(host: string, port: number, token: string, embedTimeout: number) {
        this.host = host;
        this.port = port;
        this.token = token;
        this.embedTimeout = embedTimeout;
    }

    async start(): Promise<void> {
        const app = express();
        app.use(express.json());

        this.#inferModel = (await createInitalizedModel()) as LLamaCppModel;
        this.#embedModel = (await createInitalizedEmbModel()) as LLamaCppModel;

        const auth = (req: Request, res: Response, next: NextFunction) => {
            const authHeader = req.headers["authorization"] || "";
            if (authHeader !== `Bearer ${this.token}`) {
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

            const session = this.#inferModel!.getSession("");
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
            res.setTimeout(this.embedTimeout);
            try {
                const emb = await this.#embedModel!.embed(text);
                res.json({ embedding: emb });
            } catch (err) {
                logger.error(err, "embedding error");
                res.status(500).json({ error: (err as Error).message });
            }
        });

        this.#server = app.listen(this.port, this.host, () => {
            logger.info(`llm api server started on http://${this.host}:${this.port}`);
        });
    }

    async close(): Promise<void> {
        if (this.#closing) return;
        this.#closing = true;
        if (this.#server) {
            await new Promise<void>((resolve) => {
                this.#server?.close(() => resolve());
            });
        }
        await this.#inferModel?.close();
        if (this.#embedModel && this.#embedModel !== this.#inferModel) await this.#embedModel.close();
        logger.info("llm api server closed");
        this.#closing = false;
    }
}

