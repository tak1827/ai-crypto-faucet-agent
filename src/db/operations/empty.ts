import logger from "../../utils/logger";
import { createDb, dropDb } from "./common";

export default async (schema: string) => {
	logger.info(`⏳ Dropping the ${schema} database...`);
	await dropDb(schema);
	logger.info(`⏳ Re-creating the ${schema} database (empty)...`);
	await createDb(schema);
};
