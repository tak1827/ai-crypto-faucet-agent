import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { DocumentCore } from "./document_core_entity";

export type DocumentChunkMetadata = Record<string, unknown>;

@Entity()
export class DocumentChunk {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ nullable: true })
	documentCoreId!: number;

	@ManyToOne(() => DocumentCore, { onDelete: "CASCADE" })
	@JoinColumn({ name: "documentCoreId" })
	@Index()
	documentCore!: DocumentCore;

	@Column({ type: "varchar", length: 255 })
	model!: string;

	@Column({ type: "text" })
	chunk!: string;

	@Column("vector")
	embedding!: string;

	@Column({ type: "jsonb" })
	metadata!: DocumentChunkMetadata;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
