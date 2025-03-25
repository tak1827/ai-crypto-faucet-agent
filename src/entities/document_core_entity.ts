import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";

/* eslint-disable no-unused-vars */
export enum DocumentCategory {
	UNDEFINED = "undefined",
	GENERAL = "general",
	MARKETING = "marketing",
	TECH = "tech",
	CODE = "code",
}
/* eslint-disable no-unused-vars */

@Entity()
export class DocumentCore {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: "varchar", length: 255 })
	fileName: string;

	@Column({ type: "varchar", length: 1014, nullable: true })
	filePath?: string;

	@Column({ type: "enum", enum: DocumentCategory, nullable: true })
	category?: DocumentCategory;

	@Column({ type: "text", nullable: true })
	content?: string;

	@Column({ type: "text", nullable: true })
	contentBuffer?: string;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}
