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
import { Env } from "../utils/env";
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

	_distance?: number; // Used for vector search results

	@Column({ type: "jsonb" })
	metadata!: DocumentChunkMetadata;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;

	constructor(
		model: string,
		chunk: string,
		documentCore: DocumentCore,
		metadata?: DocumentChunkMetadata,
	) {
		this.model = model;
		this.chunk = chunk;
		this.documentCore = documentCore;
		this.metadata = metadata || {};
		this.embedding = DocumentChunk.zeroEmbedding();
	}

	static zeroEmbedding(): string {
		const dims = Env.number("EMBEDDING_DIMENSION");
		return `[${Array(dims).fill(0).join(",")}]`;
	}
}
