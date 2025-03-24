import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";

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
