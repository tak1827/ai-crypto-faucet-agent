import { WorkflowManager, closeBaseCtx, createBaseCtx } from "../agent/workflow_manager";
import { airdropWork, createAirdropCtx } from "../agent/workflows/airdrop_work";
import { cheerWork, createCheerCtx } from "../agent/workflows/cheer_work";
import { createEmbeddingCtx, embeddingWork } from "../agent/workflows/embedding_work";
import { createPostCtx, postWork } from "../agent/workflows/post_work";
import { createQuotePostCtx, quotePostWork } from "../agent/workflows/quote_post_work";
import { Env } from "../utils/env";
import logger from "../utils/logger";

async function main() {
	const manager = new WorkflowManager();
	const baseCtx = await createBaseCtx();

	// Register cheer workflow
	if (Env.boolean("WORKFLOW_ENABLE_CHEER")) {
		const ctx = createCheerCtx(baseCtx);
		const interval = Env.number("WORKFLOW_INTERVAL_CHEER");
		manager.addWorkflow(interval, cheerWork, ctx, "cheer-work");
	}

	// Register post workflow
	if (Env.boolean("WORKFLOW_ENABLE_POST")) {
		const ctx = createPostCtx(baseCtx);
		const interval = Env.number("WORKFLOW_INTERVAL_POST");
		manager.addWorkflow(interval, postWork, ctx, "post-work");
	}

	// Register post workflow
	if (Env.boolean("WORKFLOW_ENABLE_QUOTE_POST")) {
		const ctx = createQuotePostCtx(baseCtx);
		const interval = Env.number("WORKFLOW_INTERVAL_QUOTE_POST");
		manager.addWorkflow(interval, quotePostWork, ctx, "quote-post-work");
	}

	// Register airdrop workflow
	// if (Env.boolean("WORKFLOW_ENABLE_AIRDROP")) {
	// 	const ctx = createAirdropCtx(baseCtx);
	// 	const interval = Env.number("WORKFLOW_INTERVAL_AIRDROP");
	// 	manager.addWorkflow(interval, airdropWork, ctx, "airdrop-work");
	// }

	// Register embedding workflow
	if (Env.boolean("WORKFLOW_ENABLE_EMBEDDING")) {
		const ctx = createEmbeddingCtx(baseCtx);
		const interval = Env.number("WORKFLOW_INTERVAL_EMBEDDING");
		manager.addWorkflow(interval, embeddingWork, ctx, "embedding-work");
	}

	await manager.start();
	await closeBaseCtx(baseCtx);
}

main().catch((err) => logger.error(err));
