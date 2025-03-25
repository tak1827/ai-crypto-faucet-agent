import fs from "node:fs";

export const validatePath = (path: string): string => {
	if (!fs.existsSync(path)) {
		throw new Error(`path not found: ${path}`);
	}
	return path;
};

export function validateIsNumber(value: string): number {
	const shouldBeNum = Number.parseInt(value, 10);
	if (Number.isNaN(shouldBeNum)) {
		throw new Error(`invalid number: ${value}`);
	}
	return shouldBeNum;
}
