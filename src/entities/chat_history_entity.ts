import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import type { Database } from "../db/db";

@Entity()
export class ChatHistory {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: "varchar", length: 255 })
	identifier!: string;

	@Column({ type: "varchar", length: 255 })
	tweetId!: string;

	@Column({ type: "varchar" })
	content!: string;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;

	constructor(identifier?: string, tweetId?: string, content?: string) {
		this.identifier = identifier || "";
		this.tweetId = tweetId || "";
		this.content = content || "";
	}
}

export const getChatHistories = async (
	db: Database,
	identifier: string,
	orderBy: "ASC" | "DESC" = "DESC",
): Promise<string[]> => {
	let result: string[] = [];
	await db.makeQuery(async (queryRunner) => {
		const histories = await queryRunner.manager.find(ChatHistory, {
			where: {
				identifier: identifier,
			},
			order: {
				createdAt: orderBy,
			},
		});
		result = histories.map((history) => {
			return history.content;
		});
	});
	return result;
};
