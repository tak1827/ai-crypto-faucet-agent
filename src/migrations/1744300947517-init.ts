import type { MigrationInterface, QueryRunner } from "typeorm";

export class Init1744300947517 implements MigrationInterface {
	name = "Init1744300947517";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "airdrop_history" ("id" SERIAL NOT NULL, "identifier" character varying(255) NOT NULL, "address" character varying(42) NOT NULL, "amount" numeric(10,3) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_09040d7f8f4ed70e0c92dc53904" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "chat_group" ("id" SERIAL NOT NULL, "groupId" character varying(255) NOT NULL, "chats" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4615844ed379806de3ff7c51a5a" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."document_core_category_enum" AS ENUM('undefined', 'general', 'marketing', 'tech', 'code')`,
		);
		await queryRunner.query(
			`CREATE TABLE "document_core" ("id" SERIAL NOT NULL, "fileName" character varying(255) NOT NULL, "filePath" character varying(1014), "category" "public"."document_core_category_enum", "content" text, "contentBuffer" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6b66ed7dba47382039a4eb1446e" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "document_chunk" ("id" SERIAL NOT NULL, "model" character varying(255) NOT NULL, "chunk" text NOT NULL, "embedding" vector NOT NULL, "metadata" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "documentCoreId" integer, CONSTRAINT "PK_70d9772bf367d82f9b7e568c87c" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_efd746127a8e1d969ad31f7d9b" ON "document_chunk" ("documentCoreId") `,
		);
		await queryRunner.query(
			`CREATE TYPE "public"."sns_follow_type_enum" AS ENUM('twitter', 'discord')`,
		);
		await queryRunner.query(
			`CREATE TABLE "sns_follow" ("id" SERIAL NOT NULL, "identifier" character varying(255) NOT NULL, "type" "public"."sns_follow_type_enum" NOT NULL DEFAULT 'twitter', "isFollowing" boolean NOT NULL DEFAULT true, "tweetId" character varying(255) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b05b6c888a677e3b655eef61baf" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "chat_history" ("id" SERIAL NOT NULL, "identifier" character varying(255) NOT NULL, "externalId" character varying(255) NOT NULL, "content" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cf76a7693b0b075dd86ea05f21d" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "chat_summary" ("id" SERIAL NOT NULL, "identifier" character varying(255) NOT NULL, "content" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_66423ff72e4634d90a3f1ddccef" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`ALTER TABLE "document_chunk" ADD CONSTRAINT "FK_efd746127a8e1d969ad31f7d9b9" FOREIGN KEY ("documentCoreId") REFERENCES "document_core"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "document_chunk" DROP CONSTRAINT "FK_efd746127a8e1d969ad31f7d9b9"`,
		);
		await queryRunner.query(`DROP TABLE "chat_summary"`);
		await queryRunner.query(`DROP TABLE "chat_history"`);
		await queryRunner.query(`DROP TABLE "sns_follow"`);
		await queryRunner.query(`DROP TYPE "public"."sns_follow_type_enum"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_efd746127a8e1d969ad31f7d9b"`);
		await queryRunner.query(`DROP TABLE "document_chunk"`);
		await queryRunner.query(`DROP TABLE "document_core"`);
		await queryRunner.query(`DROP TYPE "public"."document_core_category_enum"`);
		await queryRunner.query(`DROP TABLE "chat_group"`);
		await queryRunner.query(`DROP TABLE "airdrop_history"`);
	}
}
