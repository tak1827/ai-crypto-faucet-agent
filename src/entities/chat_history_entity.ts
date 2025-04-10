import {
	Column,
	CreateDateColumn,
	Entity,
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

	@Column({ type: "varchar" })
	content!: string;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;

	constructor(identifier?: string, externalId?: string, content?: string) {
		this.identifier = identifier || "";
		this.externalId = externalId || "";
		this.content = content || "";
		this.createdAt = new Date();
	}
}

export const getChatHistories = async (
	db: Database,
	identifier: string,
	limit = 100,
	orderBy: "ASC" | "DESC" = "DESC",
): Promise<ChatHistory[]> => {
	let result = [] as ChatHistory[];
	await db.makeQuery(async (queryRunner) => {
		result = await queryRunner.manager.find(ChatHistory, {
			where: {
				identifier: identifier,
			},
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
