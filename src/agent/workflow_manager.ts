import type { Database } from "../db/db";
import type { ILLMModel } from "../models/model";
import type { Twitter } from "../twitter/twitter";
import logger from "../utils/logger";
const WORKFLOW_INTERVAL = 200;
const MINIMAL_INTERVAL = WORKFLOW_INTERVAL * 2;

export type Work = (ctx: WorkflowContext) => Promise<void>;

export type WorkflowState = {
	type: string;
	[key: string]: any; // allows flexibility for derived types
};

export type WorkflowContext = {
	db: Database;
	twitter: Twitter;
	models: Record<string, ILLMModel>;
	state: WorkflowState;
};

export class WorkflowManager {
	#workflows: Record<
		string,
		{ work: Work; interval: number; ctx: WorkflowContext; expireAt: number }
	> = {};
	#interval: NodeJS.Timer;
	#running = false;
	#closing = false;

	constructor() {
		process.on("SIGINT", () => this.close());
		process.on("SIGTERM", () => this.close());
	}

	async close() {
		logger.info("closing workflow manager...");
		this.#closing = true;
		if (this.#running) await this.#waitClosed();
	}

	public async start(): Promise<void> {
		this.#running = true;
		this.#closing = false;

		return new Promise((resolve) => {
			this.#setExpireAll(Date.now());
			this.#interval = setInterval(async () => {
				// Stop the interval if closing
				if (this.#closing) {
					this.#running = false;
					clearInterval(this.#interval);
					logger.info("workflow mangager interval stopped");
					resolve();
					return;
				}

				// Iterate through all workflows
				for (const key in this.#workflows) {
					const workflow = this.#workflows[key];
					// skip if workflow is not set or not expired
					if (!workflow || Date.now() < workflow.expireAt) continue;
					await workflow.work(workflow.ctx);
					this.#setExpire(key);
				}
			}, WORKFLOW_INTERVAL);
		});
	}

	addWorkflow(
		interval: number,
		work: Work,
		ctx: WorkflowContext,
		name?: string,
	): void {
		if (interval < MINIMAL_INTERVAL) {
			throw new Error(
				`Interval is too short. interval: ${interval}, minimal: ${MINIMAL_INTERVAL}`,
			);
		}
		if (this.#workflows[ctx.state.name]) {
			throw new Error(`Workflow already exists. name: ${ctx.state.name}`);
		}
		const key = name || ctx.state.name;
		this.#workflows[key] = { work, interval, ctx, expireAt: 0 };
	}

	removeWorkflow(name: string): WorkflowState {
		if (!this.#workflows[name]) {
			throw new Error(`Workflow not found. name: ${name}`);
		}
		const state = this.#workflows[name].ctx.state;
		delete this.#workflows[name];
		return state;
	}

	async #waitClosed(): Promise<void> {
		return new Promise((resolve) => {
			const interval = setInterval(() => {
				if (!this.#running) {
					clearInterval(interval);
					resolve();
				}
			}, WORKFLOW_INTERVAL);
		});
	}

	#setExpire(key: string, now: number = Date.now()) {
		if (!this.#workflows[key]) return;
		this.#workflows[key].expireAt = now + this.#workflows[key].interval;
	}

	#setExpireAll(now?: number) {
		for (const key in this.#workflows) {
			this.#setExpire(key, now);
		}
	}
}
