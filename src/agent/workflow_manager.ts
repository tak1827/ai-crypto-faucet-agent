import { Chain } from "../chain";
import { Database } from "../db";
import { AppDataSource } from "../db/ormconfig";
import {
	type ILLMModel,
	LLamaCppModel,
	LlamaCppClient,
	createInitalizedModel,
} from "../models";
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
		// forcefully stop after `timeoutMs` ms
		const timeoutMs = 10_000;
		const forceExiter = setTimeout(() => {
			logger.warn(`forcefully stopping workflow manager after timeout: ${timeoutMs}ms`);
			process.exit(0);
		}, timeoutMs);
		// Wait for the interval to stop
		if (this.#running) await this.#waitClosed(forceExiter);
	}

	public async start(): Promise<void> {
		this.#running = true;

		return new Promise((resolve) => {
			this.#setExpireAll(Date.now());
			this.#interval = setInterval(async () => {
				// Stop the interval if closing
				if (this.#closing) {
					clearInterval(this.#interval);
					this.#interval = undefined;
					this.#running = false;
					logger.info("workflow mangager interval stopped");
					resolve();
					return;
				}

				// Iterate through all workflows
				for (const key in this.#workflows) {
					if (this.#closing) break;

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
		logger.info(
			`Workflow added. name: ${key}, interval: ${interval}, state: ${JSON.stringify(
				ctx.state,
			)}`,
		);
	}

	removeWorkflow(name: string): WorkflowState {
		if (!this.#workflows[name]) {
			throw new Error(`Workflow not found. name: ${name}`);
		}
		const state = this.#workflows[name].ctx.state;
		delete this.#workflows[name];
		return state;
	}

	async #waitClosed(forceExiter: Timer): Promise<void> {
		return new Promise((resolve) => {
			const interval = setInterval(() => {
				if (!this.#running) {
					clearInterval(interval);
					clearTimeout(forceExiter);
					this.#closing = false;
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
	noClient?: boolean,
): Promise<BaseWorkflowContext> => {
	const db = await new Database(AppDataSource).init();
	const twitter = isTest ? new mockTwitter() : Twitter.create().startOAuthServer();
	let model: ILLMModel | undefined;
	let emodel: ILLMModel | undefined;
	if (noClient) {
		model = await new LLamaCppModel(Env.path("LLM_MODEL_PATH")).init();
		emodel = await new LLamaCppModel(Env.path("LLM_EMBEDDING_MODEL_PATH")).init();
	} else {
		model = await createInitalizedModel(LlamaCppClient.name);
		emodel = model;
	}
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

export const closeBaseCtx = async (ctx: BaseWorkflowContext): Promise<void> => {
	await ctx.twitter.close();
	await ctx.db.close();
	ctx.chain.provider.destroy();
	if (ctx.models.common instanceof LLamaCppModel) {
		await ctx.models.common.close();
	}
	if (ctx.models.embed instanceof LLamaCppModel) {
		await ctx.models.embed.close();
	}
};
