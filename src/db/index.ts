import type { DataSource, ObjectLiteral, QueryRunner, SelectQueryBuilder } from "typeorm";
import logger from "../utils/logger";

export class Database {
	private appDataSource: DataSource;
	private queryRunner!: QueryRunner;

	constructor(appDataSource: DataSource) {
		this.appDataSource = appDataSource;
	}

	/**
	 * Initializes the database connection and creates a new query runner.
	 * This method connects to the database using the provided AppDataSource.
	 */
	public async init(): Promise<Database> {
		// Initialize the data source, establishing a connection to the database.
		await this.appDataSource.initialize();
		logger.debug("Data Source has been initialized!");

		// Create a new query runner instance from the data source.
		this.queryRunner = this.appDataSource.createQueryRunner();
		return this;
	}

	public async close(): Promise<void> {
		await this.queryRunner.release();
		await this.appDataSource.destroy();
		logger.info("database connection closed");
	}

	public async makeQuery(task: (_: QueryRunner) => Promise<void>): Promise<void> {
		await this.queryRunner.connect();
		await task(this.queryRunner);
		// await this.queryRunner.release();
	}

	/**
	 * Executes a task within a transaction.
	 *
	 * This method uses a query runner to start a transaction, execute a provided task,
	 * commit the transaction if the task succeeds, or roll back if an error occurs.
	 * Finally, it releases the query runner regardless of success or failure.
	 *
	 * @param task - An asynchronous function that contains the transactional operations.
	 */
	public async makeTransaction(task: (_: QueryRunner) => Promise<void>): Promise<void> {
		// Establish a real database connection using the query runner.
		await this.queryRunner.connect();

		// Start a new transaction.
		await this.queryRunner.startTransaction();

		let wrapErr: Error | null = null;
		try {
			// Execute the provided task, passing the current query runner.
			await task(this.queryRunner);

			// If the task completes without errors, commit the transaction.
			await this.queryRunner.commitTransaction();
		} catch (err) {
			// Log any errors encountered during the task execution.
			logger.warn(err, "Error while saving");

			wrapErr = new Error(
				`Error while saving. rollback transaction. ${(err as Error).message}`,
			);

			// Roll back the transaction in case of an error.
			await this.queryRunner.rollbackTransaction();
		} finally {
			// Release the query runner to free up resources.
			// await this.queryRunner.release();
		}
		if (wrapErr) throw wrapErr;
	}

	public async saveEntities<Entity>(entities: Entity[]): Promise<void> {
		await this.makeTransaction(async (queryRunner) => {
			await queryRunner.manager.save(entities);
		});
	}

	public async *eachRow<Entity extends ObjectLiteral>(
		query: SelectQueryBuilder<Entity>,
	): AsyncGenerator<Entity, void, any> {
		const totalCount = await query.getCount();
		logger.info(`${totalCount} rows found in the query`);

		for (let i = 0; i < totalCount; i++) {
			const entity = await query.skip(i).take(1).getOne();
			if (entity) yield entity;
		}
	}

	async vectorSearch<T = any>(
		tableName: string,
		vectorColumnName: string,
		query: readonly number[],
		k = 3,
		filter?: { [key: string]: any },
		whereQuery?: string,
	): Promise<T> {
		// build where clause
		const whereParts = [] as string[];
		if (tableName === "document_chunk") whereParts.push("metadata @> $3");
		if (whereQuery) whereParts.push(whereQuery);
		const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
		// build sql query
		const sql = `
	    SELECT *, ${vectorColumnName} <=> $1 as "_distance"
	    FROM ${tableName} ${whereClause}
	    ORDER BY "_distance" ASC
	    LIMIT $2;`;
		// build parameters
		const parameters: any[] = [`[${query.join(",")}]`, k];
		if (tableName === "document_chunk") parameters.push(filter ?? "{}");
		logger.debug(`sql: ${sql}`);
		return await this.appDataSource.query(sql, parameters);
	}

	async vectorSearchTables(
		tables: { tableName: string; textCol: string }[],
		query: readonly number[],
		k = 3,
	): Promise<{ id: number; _distance: number; text: string }[]> {
		if (tables.length < 2) {
			throw new Error(
				"At least two table names are required for vector search across multiple tables.",
			);
		}
		// build sql query
		const selectQury = tables.reduce((acc, { tableName, textCol }) => {
			const prefix = acc === "" ? "" : `${acc} UNION ALL`;
			return `${prefix} SELECT id, ${textCol} as text, embedding <=> $1 AS "_distance" FROM ${tableName}`;
		}, "");
		const sql = `SELECT * FROM (${selectQury}) AS combined ORDER BY "_distance" ASC LIMIT $2;`;
		// build parameters
		const parameters: any[] = [`[${query.join(",")}]`, k];
		return await this.appDataSource.query(sql, parameters);
	}
}
