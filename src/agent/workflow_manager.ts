import { Chain } from "../chain";
import { Database } from "../db";
import { AppDataSource } from "../db/ormconfig";
import type { ILLMModel } from "../models";
import { LLamaCppModel } from "../models/llama_cpp";
import { Twitter } from "../twitter";
import { mockTwitter } from "../twitter/mock";
import { Env } from "../utils/env";
import logger from "../utils/logger";
import { Memory } from "./memory";
const WORKFLOW_INTERVAL = 200;
const MINIMAL_INTERVAL = WORKFLOW_INTERVAL * 2;

export type Work = (ctx: WorkflowContext) => Promise<Error | null>;

export type WorkflowState = {
	name: string;
	[key: string]: any; // allows flexibility for derived types
};

export type WorkflowContext = {
	db: Database;
	twitter: Twitter;
	models: { common: ILLMModel; embed: ILLMModel } & Record<string, ILLMModel>;
	chain: Chain;
	memory: Memory;
	state: WorkflowState;
};

export type BaseWorkflowContext = Omit<WorkflowContext, "state">;

export class WorkflowManager {
	#workflows: Record<
		string,
		{ work: Work; interval: number; ctx: WorkflowContext; expireAt: number; running: boolean }
	> = {};
	#interval: NodeJS.Timer | undefined;
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
					// skip if workflow is not set or not expired or already running
					if (!workflow || Date.now() < workflow.expireAt || workflow.running) continue;
					this.#setRunning(key, true);
					const err = await workflow.work(workflow.ctx);
					if (err) logger.error(err, `Workflow error. name: ${key}`);
					this.#setExpire(key);
					this.#setRunning(key, false);
				}
			}, WORKFLOW_INTERVAL);
		});
	}

	addWorkflow(interval: number, work: Work, ctx: WorkflowContext, name?: string): void {
		if (interval < MINIMAL_INTERVAL) {
			throw new Error(
				`Interval is too short. interval: ${interval}, minimal: ${MINIMAL_INTERVAL}`,
			);
		}
		if (this.#workflows[ctx.state.name]) {
			throw new Error(`Workflow already exists. name: ${ctx.state.name}`);
		}
		const key = name || ctx.state.name;
		this.#workflows[key] = { work, interval, ctx, expireAt: 0, running: false };
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

	#setRunning(key: string, running: boolean) {
		if (!this.#workflows[key]) return;
		this.#workflows[key].running = running;
	}
}

export const createBaseCtx = async (
	isTest?: boolean,
	noEmbed?: boolean,
): Promise<BaseWorkflowContext> => {
	const db = await new Database(AppDataSource).init();
	const twitter = isTest ? new mockTwitter() : Twitter.create();
	const model = await new LLamaCppModel(Env.path("WORKFLOW_MODEL_PATH")).init();
	const emodel = noEmbed
		? model
		: await new LLamaCppModel(Env.path("WORKFLOW_EMBEDDING_MODEL_PATH")).init();
	const chain = Chain.create();
	const memory = Memory.create(db, twitter.ownId);
	return {
		db,
		models: { common: model, embed: emodel },
		twitter: twitter as Twitter,
		chain,
		memory,
	};
};
