import * as fs from "node:fs";
import { input } from "@inquirer/prompts";
import { listPrompt } from "../db/menus";
import { DUMP_DIR } from "../db/operations/common";
import empty from "../db/operations/empty";
import dbReload from "../db/operations/reload";
import dbSnapshot from "../db/operations/snapshot";
import { Env } from "../utils/env"; // Must imported first
import logger from "../utils/logger";

type OptionsListDef = {
	id: string;
	text: string;
};

const DEFAULT_SNAPSHOT_NAME = "instant";

const mapToOptions = (types: readonly string[], suffix?: string): OptionsListDef[] =>
	types.map((name) => ({
		id: name,
		text: suffix ? `"${name}" ${suffix}` : name,
	}));

const menus = {
	main: async (): Promise<void> => {
		const plist = await listPrompt("What would you like to do?", [
			{
				text: `Take "${DEFAULT_SNAPSHOT_NAME}" snapshot`,
				action: async () => await dbSnapshot(DEFAULT_SNAPSHOT_NAME),
			},
			{
				text: `Restore "${DEFAULT_SNAPSHOT_NAME}" snapshot (no migrations)`,
				action: async () => await dbReload(Env.string("DB_SCHEMA"), DEFAULT_SNAPSHOT_NAME),
			},
			"---",
			{
				text: "Reload snapshot",
				action: async () => {
					const snapshotName = await menus.pickSnapshot(
						"Select snapshot to reload the DB with:",
					);
					if (snapshotName) dbReload(Env.string("DB_SCHEMA"), snapshotName);
					else logger.warn("No snapshot found");
				},
			},
			{
				text: "Take local snapshot",
				action: async () => {
					const snapshotName = await menus.pickSnapshot(
						"Select snapshot to save the local DB as:",
						true,
					);
					if (snapshotName) dbSnapshot(snapshotName);
				},
			},
			{
				text: "Purge previous snapshots",
				action: async () => {
					if (!fs.existsSync(DUMP_DIR)) return;
					// biome-ignore lint/complexity/noForEach:
					fs.readdirSync(DUMP_DIR, { withFileTypes: true })
						.filter((entry) => entry.isDirectory())
						.forEach((entry) => {
							const path = `${DUMP_DIR}/${entry.name}/previous`;
							if (fs.existsSync(path)) {
								logger.info(path, "🔪");
								fs.rmSync(path, { recursive: true, force: true });
							}
						});
				},
			},
			"---",
			{
				text: "Recreate database",
				action: async () => {
					await empty(Env.string("DB_SCHEMA"));
				},
			},
		]);

		await plist.action?.();
	},

	pickSnapshotName: async (): Promise<string> => {
		const answer = await input({
			message: "Name for your snapshot:",
			default: "snapshot",
		});
		return answer;
	},

	pickSnapshot: async (message: string, showNewOption = false): Promise<string | null> => {
		const dumpDirExists = fs.existsSync(DUMP_DIR);
		if (dumpDirExists) {
			const directories = fs
				.readdirSync(DUMP_DIR, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name);

			if (directories.length) {
				const plist = await listPrompt(message, [
					...(showNewOption
						? [
								{ id: "_new", text: "New snapshot" } as OptionsListDef,
								"---" as unknown as OptionsListDef, // Casting separator as needed
							]
						: []),
					...mapToOptions(directories),
				]);

				if (plist.id !== "_new") return plist.id as string;
			}
		}

		return !showNewOption && !dumpDirExists ? null : await menus.pickSnapshotName();
	},
};

menus.main().catch((e) => logger.error(e));
