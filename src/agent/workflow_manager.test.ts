import { expect, test } from "bun:test";
import { sleep } from "../utils/utils";
import {
	type WorkflowContext,
	WorkflowManager,
	type WorkflowState,
} from "./workflow_manager";

type CountState = WorkflowState & {
	name: "count";
	counter: number;
};

const countWork = async (ctx: WorkflowContext): Promise<void> => {
	const state = ctx.state as CountState;
	state.counter += 1;
};

test("WorkflowManager works", async () => {
	const manager = new WorkflowManager();
	const ctx1: unknown = { state: { counter: 0 } };
	const ctx2: unknown = { state: { counter: 0 } };
	const interval = 500;
	const iterateCount = 3;

	manager.addWorkflow(interval, countWork, ctx1 as WorkflowContext, "count1");
	manager.addWorkflow(interval, countWork, ctx2 as WorkflowContext, "count2");

	manager.start();

	await sleep(interval * iterateCount);

	const state1 = manager.removeWorkflow("count1") as CountState;
	expect(state1.counter).toBeGreaterThanOrEqual(iterateCount - 1);

	await manager.close();
});
