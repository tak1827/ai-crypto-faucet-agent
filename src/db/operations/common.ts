import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { Env } from "../../utils/env";
import logger from "../../utils/logger";

// export const DB_ROOT_DIR = Env.string("DB_ROOT_DIR || resolve(process.cwd(), '')
export const PROJECT_ROOT_DIR = resolve(process.cwd(), "");
export const SQL_DIR = join(PROJECT_ROOT_DIR, "data", "sql");
export const DUMP_DIR = join(SQL_DIR, "dumps");
export const LOGS_DIR = "previous";

export const MSG_DONE = "✅ done!";
export const MSG_WARNING = "⚠️ ooops";
export const MSG_ERROR = "💥 error!";

export const LOCAL_ENV_NAME = "local";
export const TEST_ENV_NAME = "test";
export const LOCAL_ENV_NAMES = [LOCAL_ENV_NAME, TEST_ENV_NAME];
export const REMOTE_ENV_NAMES = ["dev", "stg", "demo", "prod"];
export const ALL_INIT_ENV_NAMES = [...LOCAL_ENV_NAMES, ...REMOTE_ENV_NAMES];

export const NOW_UTC_PREFIX = new Date()
	.toISOString()
	.replace(/[-:TZ]/g, "")
	.slice(0, 14);

let CREDENTIALS = "";
if (Env.string("DB_USERNAME") && !Env.string("DB_PASSWORD")) {
	CREDENTIALS = `PGUSER=${Env.string("DB_USERNAME")}`;
} else if (Env.string("DB_USERNAME") && Env.string("DB_PASSWORD")) {
	CREDENTIALS = `PGUSER=${Env.string("DB_USERNAME")} PGPASSWORD=${Env.string("DB_PASSWORD")}`;
}

const DB_PORT = Env.string("DB_PORT");
const PORT_OPTION = `-p ${DB_PORT}`;

export const POSTGRES_COMMAND = `${CREDENTIALS} psql ${PORT_OPTION}`;
export const POSTGRES_COMMAND_ON_DB = `${POSTGRES_COMMAND} ${Env.string("DB_SCHEMA")}`;
export const POSTGRESDUMP_COMMAND = `${CREDENTIALS} pg_dump ${PORT_OPTION}`;

export const isInList = (val: string, list: string[]) => list.includes(val);

export const createSqlFile = async (
	header: string,
	name: string,
	type: string,
	cmd: string,
): Promise<void> => {
	logger.info(header);
	const envDumpDir = join(DUMP_DIR, name);
	const newFileName = `${NOW_UTC_PREFIX}-${type}.sql`;

	if (!existsSync(envDumpDir)) mkdirSync(envDumpDir, { recursive: true });
	if (!existsSync(join(envDumpDir, LOGS_DIR))) mkdirSync(join(envDumpDir, LOGS_DIR));

	// biome-ignore lint/complexity/noForEach:
	readdirSync(envDumpDir).forEach((file) => {
		if (file.endsWith(`-${type}.sql`)) {
			renameSync(join(envDumpDir, file), join(envDumpDir, LOGS_DIR, file));
		}
	});

	const command = `${cmd} > ${join(envDumpDir, newFileName)}`;
	logger.debug(`Running command: ${command}`);
	await runShellCmd(command);
};

export const loadSqlFiles = async (
	dumpDir: string,
	subdir: string,
	filter?: string,
	dbSchema?: string,
): Promise<void> => {
	const dir = join(dumpDir, subdir);
	const schema = dbSchema || Env.string("DB_SCHEMA");
	const files = readdirSync(dir)
		.filter((file) => file.endsWith(".sql"))
		.filter((file) => (filter ? file.includes(filter) : true));

	if (files.length > 0) {
		// biome-ignore lint/complexity/noForEach:
		files.forEach(async (file) => {
			logger.info(`⏳ Loading from "${file}"...`);
			const command = `${POSTGRES_COMMAND} --quiet ${schema} < ${join(dir, file)}`;
			logger.debug(`Running command: ${command}`);
			await runShellCmd(command);
		});
	} else {
		logger.warn(`⚠️ No files found in "${dir}" (for env: ${subdir})`);
	}
};

export const createDb = async (dbSchema: string) => {
	// create db
	const command = `${POSTGRES_COMMAND} --quiet -c "CREATE DATABASE ${dbSchema} ENCODING 'UTF8';"`;
	logger.debug(`Running command: ${command}`);
	await runShellCmd(command);
	// enable pgvector extension
	const commandVec = `${POSTGRES_COMMAND} --quiet -d ${dbSchema} -c "CREATE EXTENSION vector;"`;
	logger.debug(`Running command: ${commandVec}`);
	await runShellCmd(commandVec);
};

export const dropDb = async (dbSchema: string) => {
	const command = `${POSTGRES_COMMAND} --quiet -c "DROP DATABASE IF EXISTS ${dbSchema};"`;
	logger.debug(`Running command: ${command}`);
	await runShellCmd(command);
};

/**
 * Runs a shell command and returns a Promise that resolves with the exit code.
 * @param command The shell command to run.
 * @returns A Promise that resolves to 0 if the command exits successfully.
 */
export const runShellCmd = (command: string): Promise<number> =>
	new Promise((resolve, reject) => {
		const cmd = spawn(command, {
			shell: true,
			stdio: "inherit", // Inherit stdio so that command output appears in the console.
		});

		cmd.on("close", (code: number | null) => {
			if (code === 0) {
				resolve(code);
			} else {
				reject(new Error(`Command exited with code ${code}`));
			}
		});
	});
