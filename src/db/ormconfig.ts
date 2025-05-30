import "reflect-metadata";
import { resolve } from "node:path";
import { DataSource } from "typeorm";
import { Env } from "../utils/env";
import logger from "../utils/logger";

const isTest = process.env.NODE_ENV && process.env.NODE_ENV === "test";
const database = isTest ? Env.string("DB_SCHEMA_TEST") : Env.string("DB_SCHEMA");
if (!isTest) logger.info(`You will connect to non-test database: ${database}`);

export const AppDataSource = new DataSource({
	type: "postgres",
	host: Env.string("DB_HOST"),
	port: process.env.DB_PORT ? Env.number("DB_PORT") : undefined,
	username: Env.string("DB_USERNAME"),
	password: Env.string("DB_PASSWORD"),
	database,
	synchronize: false,
	logging: false,
	entities: [resolve(__dirname, "../**/entities/*.ts")],
	migrations: ["src/**/migrations/*.ts"],
	subscribers: [],
});

// @ts-ignore TypeORM does not support but the database supports
// Ref: https://github.com/typeorm/typeorm/issues/10056
AppDataSource.driver.supportedDataTypes.push("vector");
