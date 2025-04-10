import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import type { Database } from "../db";

export enum SNSType {
	TWITTER = "twitter", // default
	DISCORD = "discord",
}

@Entity()
export class SNSFollow {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: "varchar", length: 255 })
	identifier!: string;

	@Column({ type: "enum", enum: SNSType, default: SNSType.TWITTER })
	type!: SNSType;

	@Column({ type: "boolean", default: true })
	isFollowing!: boolean;

	@Column({ type: "varchar", length: 255 })
	tweetId!: string;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;

	constructor(identifier?: string, type: SNSType = SNSType.TWITTER) {
		this.identifier = identifier || "";
		this.type = type;
	}
}

export const isFollowingSNS = async (
	db: Database,
	identifier: string,
	type: SNSType = SNSType.TWITTER,
): Promise<boolean> => {
	let following = false;
	await db.makeQuery(async (queryRunner) => {
		const follows = await queryRunner.manager.find(SNSFollow, {
			where: {
				identifier: identifier,
			},
		});
		following = follows.some((follow) => {
			return follow.isFollowing && follow.type === type;
		});
	});
	return following;
};
