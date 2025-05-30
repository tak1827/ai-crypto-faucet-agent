import { resolve } from "node:path";
import { confirm, input, select } from "@inquirer/prompts";
import { Database } from "../db";
import { AppDataSource } from "../db/ormconfig";
import { DocumentChunk } from "../entities/document_chunk_entity";
import { DocumentCategory, DocumentCore } from "../entities/document_core_entity";
import { createInitalizedEmbModel } from "../models";
import { LangChainTextSplitter } from "../splitter/splitter_langchain";
import { Env } from "../utils/env";
import logger from "../utils/logger";
// import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
// import { TokenTextSplitter } from 'llamaindex';
import { validatePath } from "../utils/validation";

async function main() {
	// Ask the user for the directory path
	const directoryInput = await input({
		message: "Where should we load the files from?",
		default: Env.path("DIR_EMBEDDING_DOCUMENT"),
	});
	const path = resolve(directoryInput);
	validatePath(path);

	// Choose the category
	const category = await select({
		message: "Which category would you like to use?",
		choices: Object.values(DocumentCategory).map((category) => ({
			name: category,
			value: category,
		})),
		default: DocumentCategory.UNDEFINED,
	});

	const saveToDatabase = await confirm({
		message: "Do you want to save the split documents into the database?",
		default: true,
	});

	const model = await createInitalizedEmbModel();

	const spliter = new LangChainTextSplitter();
	const chunkSize = Env.number("SPLITTER_CHUNK_SIZE");
	const chunkOverlap = Env.number("SPLITTER_CHUNK_OVERLAP");
	const ignorePaths = Env.array("SPLITTER_IGNORE_PATHS");

	const db = await new Database(AppDataSource).init();

	// Save the split documents into the database
	await db.makeTransaction(async (queryRunner) => {
		await model.embedContext(async (embedder) => {
			for await (const splittedFile of spliter.split(
				path,
				chunkSize,
				chunkOverlap,
				ignorePaths,
			)) {
				if (!splittedFile[0]) {
					logger.warn("Empty file");
					continue;
				}

				const firstChunk = splittedFile[0];
				logger.info(
					`Successfully split docs into ${splittedFile.length} chunks. Title: ${firstChunk.filePath}`,
				);

				// Find document by filePath
				let docCore = await queryRunner.manager.findOne(DocumentCore, {
					where: { filePath: splittedFile[0]?.filePath },
				});

				if (docCore) {
					logger.warn(`Already exists, so updating: ${firstChunk.fileName}`);
					// Delete all the related chunks
					await queryRunner.manager.delete(DocumentChunk, {
						documentCore: docCore,
					});
				} else {
					docCore = new DocumentCore();
					docCore.fileName = firstChunk.fileName;
					docCore.filePath = firstChunk.filePath;
					logger.debug(`Saving core document: ${firstChunk.fileName}`);
					if (saveToDatabase) await queryRunner.manager.save(docCore);
				}

				let i = 0;
				for (const chunk of splittedFile) {
					i++;
					const docChunk = new DocumentChunk();
					if (docCore) docChunk.documentCore = docCore;
					docChunk.chunk = chunk.content.replace(/\0/g, "");
					docChunk.model = model.name();
					docChunk.metadata = chunk.metadata ? { ...chunk.metadata, category } : { category };

					try {
						const text = `FileName: ${docCore.fileName}\nContent: ${chunk.content}`;
						const embeds = await embedder(text);
						docChunk.embedding = `[${embeds.join(",")}]`;
					} catch (err) {
						logger.error(err, `Failed to embed ${i} chunk for document: ${docCore?.fileName}`);
						continue;
					}

					logger.debug(`Saving ${i} chunk for document: ${docCore?.fileName}`);
					if (saveToDatabase) await queryRunner.manager.save(docChunk);
				}
			}
		});
		logger.info("embedding completed");
		await model.close();
	});
	logger.info("DB transaction completed");
	await db.close();

	logger.info("All done!");
}

main().catch((e) => logger.error(e));
