import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import type { Database } from "../db";

@Entity()
export class AirdropHistory {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: "varchar", length: 255 })
	identifier!: string;

	@Column({ type: "varchar", length: 42 })
	address!: string;

	@Column({ type: "decimal", precision: 10, scale: 3 })
	amount!: number;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;

	constructor(identifier: string, address: string, amount: number) {
		this.identifier = identifier;
		this.address = address;
		this.amount = amount;
	}
}

export const getAirdropHistories = async (
	db: Database,
	identifier: string,
	orderBy: "ASC" | "DESC" = "DESC",
): Promise<AirdropHistory[]> => {
	let result: AirdropHistory[] = [];
	await db.makeQuery(async (queryRunner) => {
		const histories = await queryRunner.manager.find(AirdropHistory, {
			where: {
				identifier: identifier,
			},
			order: {
				createdAt: orderBy,
			},
		});
		result = histories.map((history) => {
			return history;
		});
	});
	return result;
};
