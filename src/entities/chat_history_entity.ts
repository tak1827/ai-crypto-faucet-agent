import {
	Column,
	CreateDateColumn,
	Entity,
	IsNull,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import type { Database } from "../db";

@Entity()
export class ChatHistory {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: "varchar", length: 255 })
	identifier!: string;

	@Column({ type: "varchar", length: 255 })
	externalId!: string; // TweetId

	// Reply: TweetId
	// Post reference: URL of the referenced post
	@Column({ type: "varchar", length: 255, nullable: true })
	referenceId?: string;

	@Column({ type: "varchar" })
	content!: string;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;

	constructor(
		identifier?: string,
		externalId?: string,
		content?: string,
		referenceId?: string,
	) {
		this.identifier = identifier || "";
		this.externalId = externalId || "";
		this.content = content || "";
		if (referenceId) this.referenceId = referenceId;
		this.createdAt = new Date();
	}
}

export const getChatHistories = async (
	db: Database,
	identifier: string,
	referenceId: string | null | undefined = undefined,
	limit = 100,
	orderBy: "ASC" | "DESC" = "DESC",
): Promise<ChatHistory[]> => {
	const where: any = { identifier };
	if (referenceId === null) where.referenceId = IsNull();
	else if (referenceId) where.referenceId = referenceId;

	let result = [] as ChatHistory[];
	await db.makeQuery(async (queryRunner) => {
		result = await queryRunner.manager.find(ChatHistory, {
			where,
			take: limit,
			order: {
				createdAt: orderBy,
			},
		});
	});
	return result;
};

export const getChatHistory = async (
	db: Database,
	identifier: string,
	externalId: string,
): Promise<ChatHistory | null> => {
	let result: ChatHistory | null = null;
	await db.makeQuery(async (queryRunner) => {
		const history = await queryRunner.manager.findOne(ChatHistory, {
			where: { identifier, externalId },
		});
		result = history;
	});
	return result;
};

export const getAllChatHistories = async (
	db: Database,
	limit = 100,
	orderBy: "ASC" | "DESC" = "DESC",
): Promise<ChatHistory[]> => {
	let result = [] as ChatHistory[];
	await db.makeQuery(async (queryRunner) => {
		result = await queryRunner.manager.find(ChatHistory, {
			take: limit,
			order: {
				createdAt: orderBy,
			},
		});
	});
	return result;
};

export const getChatHistoryByRefId = async (
	db: Database,
	referenceId: string,
): Promise<ChatHistory | null> => {
	let result: ChatHistory | null = null;
	await db.makeQuery(async (queryRunner) => {
		const history = await queryRunner.manager.findOne(ChatHistory, {
			where: { referenceId },
		});
		result = history;
	});
	return result;
};
