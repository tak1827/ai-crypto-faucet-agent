import { constants, accessSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as path from "node:path";

export function readFromFile<T>(filepath: string): T | null {
	try {
		const data = readFileSync(filepath, "utf-8");
		return JSON.parse(data) as T;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			// Return null if the file does not exist
			return null;
		}
		throw new Error(`Failed to read file: ${filepath}, err: ${(err as Error).message}`);
	}
}

export function writeToFile<T>(filepath: string, state: T): void {
	const dir = path.dirname(filepath);

	try {
		accessSync(dir, constants.F_OK);
	} catch {
		// Create directory if it doesn't exist
		mkdirSync(dir, { recursive: true });
	}

	const data = JSON.stringify(state, null, 2);
	writeFileSync(filepath, data, "utf-8");
}
