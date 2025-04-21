import { Env } from "../../utils/env";
import { POSTGRESDUMP_COMMAND, REMOTE_ENV_NAMES, createSqlFile, isInList } from "./common";

export default async (envName: string) => {
	if (isInList(envName, REMOTE_ENV_NAMES)) {
		throw new Error(
			`💥 You cannot specify a name that matches a known remote environment (forbidden: ${REMOTE_ENV_NAMES.join(", ")})`,
		);
	}

	const DB_SCHEMA = Env.string("DB_SCHEMA");
	const DB_ORIGIN_SCHEMA = DB_SCHEMA;
	const DB_PORT = Env.string("DB_PORT");
	const DB_ORIGIN_PORT = DB_PORT;

	const DUMP_COMMAND = `${POSTGRESDUMP_COMMAND} -p ${DB_ORIGIN_PORT} -d ${DB_ORIGIN_SCHEMA} --encoding UTF8`;

	await createSqlFile(
		"⏳ Dumping the structure and data for everything (full dump)...",
		envName,
		"all",
		`${DUMP_COMMAND} --clean --create`,
	);
	await createSqlFile(
		"⏳ Dumping the structure for everything (no data)...",
		envName,
		"000-structure",
		`${DUMP_COMMAND} --schema-only`,
	);
};
