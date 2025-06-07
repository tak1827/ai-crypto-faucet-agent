import { LLMServer } from "../models/server";
import { Env } from "../utils/env";
import logger from "../utils/logger";

async function main() {
    const host = Env.string("LLM_SERVER_HOST");
    const port = Env.number("LLM_SERVER_PORT");
    const token = Env.string("LLM_SERVER_TOKEN");
    const embedTimeout = Env.number("LLM_EMBED_TIMEOUT");

    const server = new LLMServer(host, port, token, embedTimeout);
    await server.start();

    const close = async () => {
        await server.close();
    };
    process.on("SIGINT", close);
    process.on("SIGTERM", close);
}

main().catch((err) => logger.error(err));

