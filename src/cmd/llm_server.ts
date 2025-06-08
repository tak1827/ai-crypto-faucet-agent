import { LlamaCppServer } from "../models/llamacpp_server";
import { Env } from "../utils/env";
import logger from "../utils/logger";

async function main() {
	const host = Env.string("LLM_SERVER_HOST");
	const port = Env.number("LLM_SERVER_PORT");
	const token = Env.string("LLM_SERVER_TOKEN");

	const server = new LlamaCppServer(host, port, token);
	await server.start();

	const close = async () => {
		await server.close();
	};
	process.on("SIGINT", close);
	process.on("SIGTERM", close);
}

main().catch((err) => logger.error(err));
