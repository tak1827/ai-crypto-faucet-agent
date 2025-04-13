import { WorkflowManager, createBaseCtx } from "../agent/workflow_manager";
import { airdropWork, createAirdropCtx } from "../agent/workflows/airdrop_work";
import { cheerWork, createCheerCtx } from "../agent/workflows/cheer_work";
import { createPostCtx, postWork } from "../agent/workflows/post_work";
import { Env } from "../utils/env";
import logger from "../utils/logger";

async function main() {
	const manager = new WorkflowManager();
	const baseCtx = await createBaseCtx();

	// Register cheer workflow
	const ctxCheer = createCheerCtx(baseCtx);
	const cheerWorkInterval = Env.number("WORKFLOW_INTERVAL_CHEER");
	manager.addWorkflow(cheerWorkInterval, cheerWork, ctxCheer, "cheer-work");

	// Register post workflow
	const ctxPost = createPostCtx(baseCtx);
	const postWorkInterval = Env.number("WORKFLOW_INTERVAL_POST");
	manager.addWorkflow(postWorkInterval, postWork, ctxPost, "post-work");

	// Register airdrop workflow
	const ctxAirdrop = createAirdropCtx(baseCtx);
	const airdropWorkInterval = Env.number("WORKFLOW_INTERVAL_AIRDROP");
	manager.addWorkflow(airdropWorkInterval, airdropWork, ctxAirdrop, "airdrop-work");

	await manager.start();
}

main().catch((err) => logger.error(err));
