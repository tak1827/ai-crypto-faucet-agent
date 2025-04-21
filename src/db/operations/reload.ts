import { DUMP_DIR, loadSqlFiles } from "./common";
import empty from "./empty";

export default async (schema: string, envName: string) => {
	//  We first reset the DB
	await empty(schema);

	// Then load all dump files for the given environment (excluding other envs)
	await loadSqlFiles(DUMP_DIR, envName, "all");
};
