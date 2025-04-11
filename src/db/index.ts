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
		const embeddingString = `[${query.join(",")}]`;
		const _whereQuery = whereQuery ? `AND ${whereQuery}` : "";
		const _filter = filter ?? "{}";

		const queryString = `
      SELECT *, ${vectorColumnName} <=> $1 as "_distance"
      FROM ${tableName}
      WHERE metadata @> $2 ${_whereQuery}
      ORDER BY "_distance" ASC
      LIMIT $3;`;

		return await this.appDataSource.query(queryString, [embeddingString, _filter, k]);
	}
}
