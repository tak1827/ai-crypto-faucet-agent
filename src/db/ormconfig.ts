import "reflect-metadata";
import { DataSource } from "typeorm";
import { Env } from "../utils/env";

export const AppDataSource = new DataSource({
	type: "postgres",
	host: Env.string("DB_HOST"),
	// port: +process.env.DB_PORT!,
	username: Env.string("DB_USERNAME"),
	password: Env.string("DB_PASSWORD"),
	database: Env.string("DB_SCHEMA"),
	synchronize: false,
	logging: false,
	entities: ["src/**/entities/*.ts"],
	migrations: ["src/**/migrations/*.ts"],
	subscribers: [],
});

// @ts-ignore TypeORM does not support but the database supports
// Ref: https://github.com/typeorm/typeorm/issues/10056
AppDataSource.driver.supportedDataTypes.push("vector");
