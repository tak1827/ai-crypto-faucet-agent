import type { MigrationInterface, QueryRunner } from "typeorm";

export class Init1749101712058 implements MigrationInterface {
	name = "Init1749101712058";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "chat_history" ADD "embedding" character varying`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "chat_history" DROP COLUMN "embedding"`);
	}
}
