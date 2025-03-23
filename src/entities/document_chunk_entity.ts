import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm'
import { DocumentCore, DocumentCategory } from './document_core_entity'

export type DocumentChunkMetadata = Record<string, any>

@Entity()
export class DocumentChunk {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(() => DocumentCore, { onDelete: 'CASCADE' })
  @Index()
  documentCore: DocumentCore

  @Column({ type: 'varchar', length: 255 })
  model: string

  @Column({ type: 'text' })
  chunk: string

  @Column('vector')
  embedding: string

  @Column({ type: 'jsonb' })
  metadata: DocumentChunkMetadata

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
