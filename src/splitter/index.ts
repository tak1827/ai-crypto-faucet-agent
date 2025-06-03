import fs from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import logger from "../utils/logger";
import { validatePath } from "../utils/validation";

export interface ITextSplitter {
	split(
		_path: string,
		_chunkSize?: number,
		_chunkOverlap?: number,
		_ignorePath?: string[],
	): AsyncGenerator<Document[], void, any>;

	getSupportedExtensions(): string[];
}

export class Document {
	content: string;
	fileName: string;
	filePath: string;
	metadata: { [key: string]: any };

	constructor(
		content: string,
		fileName: string,
		filePath: string,
		metadata: { [key: string]: any },
	) {
		this.content = content;
		this.fileName = fileName;
		this.filePath = filePath;
		this.metadata = metadata;
	}
}

export async function* loadFiles<T>(
	path: string,
	supportedExtensions: string[],
	load: (_extWithoutDot: string, _filePath: string) => Promise<T[]>,
	ignorePaths?: string[],
): AsyncGenerator<T[], void, any> {
	// Load a single file
	const loadFile = async (filePath: string): Promise<T[] | null> => {
		try {
			const ext = extname(filePath).toLowerCase();
			if (!supportedExtensions.includes(ext)) {
				logger.debug(`Unsupported file type: ${basename(filePath)}`);
				return null;
			}
			const extWithoutDot = ext.slice(1);

			// NOTE: PDF is loaded by each page, not single document every time
			const docs = await load(extWithoutDot, filePath);
			if (docs.length === 0) {
				logger.warn(`No document loaded from file: ${filePath}`);
				return null;
			}
			return docs;
		} catch (error) {
			logger.error(`Failed to load file: ${filePath}\n${error}`);
			return null;
		}
	};

	if (!isDirectory(path)) {
		// Just load the single file
		const doc = await loadFile(path);
		if (doc !== null) yield doc;
		return;
	}

	// Load all files from the directory
	const files = await readdir(path, { withFileTypes: true });
	for (const file of files) {
		const fullPath = resolve(path, file.name);
		if (skipPath(fullPath, ignorePaths)) continue;

		if (file.isDirectory()) {
			for await (const docs of loadFiles(fullPath, supportedExtensions, load)) {
				yield docs;
			}
		} else {
			const doc = await loadFile(fullPath);
			if (doc !== null) yield doc;
		}
	}
}

const skipPath = (path: string, ignorePaths?: string[]): boolean => {
	if (!ignorePaths) return false;
	for (const ignorePath of ignorePaths) {
		if (path.includes(ignorePath)) {
			logger.trace(`Ignoring path: ${path}`);
			return true;
		}
	}
	return false;
};

const isDirectory = (dirPath: string): boolean => {
	validatePath(dirPath);
	return fs.statSync(dirPath).isDirectory();
};

export const excludeBeforeRootPath = (filePath: string, rootPath: string): string => {
	if (!filePath.startsWith(rootPath)) return filePath;
	const p = filePath.slice(rootPath.length);
	return p.startsWith("/") || p.startsWith("\\") ? p.slice(1) : p;
};
