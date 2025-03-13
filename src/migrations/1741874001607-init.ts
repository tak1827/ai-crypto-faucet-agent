import type { MigrationInterface, QueryRunner } from "typeorm";

export class Init1741874001607 implements MigrationInterface {
	name = "Init1741874001607";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "airdrop_history" DROP COLUMN "amount"`,
		);
		await queryRunner.query(
			`ALTER TABLE "airdrop_history" ADD "amount" numeric(10,3) NOT NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "airdrop_history" DROP COLUMN "amount"`,
		);
		await queryRunner.query(
			`ALTER TABLE "airdrop_history" ADD "amount" character varying NOT NULL`,
		);
	}
}
