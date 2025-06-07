import type { MigrationInterface, QueryRunner } from "typeorm";
import { Env } from "../../utils/env";

export class Init1749214291553 implements MigrationInterface {
	name = "Init1749214291553";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "chat_history" DROP COLUMN "embedding"`);
		// At first, allow null
		await queryRunner.query(`ALTER TABLE "chat_history" ADD "embedding" vector`);
		// Set zero vector for all existing rows
		const dim = Env.number("EMBEDDING_DIMENSION");
		const zeroVector = `[${Array(dim).fill(0).join(",")}]`;
		await queryRunner.query(`UPDATE "chat_history" SET "embedding" = '${zeroVector}'::vector`);
		// Finally, set NOT NULL constraint
		await queryRunner.query(
			`ALTER TABLE "chat_history" ALTER COLUMN "embedding" SET NOT NULL;`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "chat_history" DROP COLUMN "embedding"`);
		await queryRunner.query(`ALTER TABLE "chat_history" ADD "embedding" character varying`);
	}
}
