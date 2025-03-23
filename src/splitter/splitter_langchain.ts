import { basename } from 'node:path'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { Document as DocumentLangChain } from '@langchain/core/documents'
import { type LoadersMapping } from 'langchain/document_loaders/fs/directory'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
// import { DocxLoader } from '@langchain/community/DocumentLangChain_loaders/fs/docx'
// import { PPTXLoader } from '@langchain/community/DocumentLangChain_loaders/fs/pptx'
import logger from '../utils/logger'
import { type ITextSplitter, Document, loadFiles, excludeBeforeRootPath } from './splitter'

/**
 * Class implementing the ITextSplitter interface using LangChain's text splitting capabilities.
 */
export class LangChainTextSplitter implements ITextSplitter {
  private readonly loaders: LoadersMapping = {
    '.md': file => new TextLoader(file),
    '.pdf': file => new PDFLoader(file),
    // '.docx': file => new DocxLoader(file),
    // '.pptx': file => new PPTXLoader(file),
  }

  /**
   * Supported file extensions for document processing.
   * @type {string[]}
   */
  private static readonly SUPPORTED_EXTENSIONS = [
    '.md',
    '.pdf',
    // '.xlsx'
  ]

  async *split(
    path: string,
    chunkSize: number = 1024,
    chunkOverlap: number = 128,
    ignorePaths?: string[],
  ): AsyncGenerator<Document[], void, unknown> {
    // Initialize text splitter
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    })

    const files = loadFiles<DocumentLangChain>(
      path,
      this.getSupportedExtensions(),
      (extWithoutDot: string, filePath: string) => {
        const loader = this.loaders[`.${extWithoutDot}`]
        return loader!(filePath).load()
      },
      ignorePaths,
    )

    let fileCount = 0
    for await (const file of files) {
      fileCount++
      for (const fileChunk of file)
        logger.debug(
          `Loaded: ${fileChunk.metadata.source}\n\n${fileChunk.pageContent}`,
        )

      // Split DocumentLangChains into chunks
      let docs: Document[] = []
      const chunks = await splitter.splitDocuments(file)
      chunks.forEach(chunk => {
        docs.push(this._createDocument(chunk, path))
        logger.debug(`Split: ${chunk.metadata.source}\n\n${chunk.pageContent}`)
      })
      if (docs.length > 0) yield docs
    }

    logger.info(`Split ${fileCount} number of documents`)
  }

  /**
   * Retrieves the list of supported file extensions.
   * @returns {string[]} - An array of supported file extension strings.
   */
  getSupportedExtensions(): string[] {
    return LangChainTextSplitter.SUPPORTED_EXTENSIONS
  }

  private _createDocument(langchainDoc: DocumentLangChain, rootPath: string): Document {
    const filePath = excludeBeforeRootPath(langchainDoc.metadata.source, rootPath)
    const fileName = basename(filePath)
    return new Document(
      langchainDoc.pageContent,
      fileName,
      filePath,
      langchainDoc.metadata,
    )
  }
}
