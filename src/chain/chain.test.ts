import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Database } from "../db/db";
import { AppDataSource } from "../db/ormconfig";
import { AirdropHistory } from "../entities/airdrop_history_entity";
import { Chain } from "./chain";

test("sendEth works", async () => {
	const to = "0x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b5640";
	const chain = Chain.create();
	await chain.sendEth(to, "0.1");

	// confirm the balance of to is increased
	const balance = await chain.provider.getBalance(to);
	expect(balance).toBeGreaterThan(0);
});

test("containsAddress works", () => {
	const address = "0x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b5640";

	// Contains one address
	let validTexts = [
		`${address}`,
		`Hello! ${address} World!`,
		`Hello! ${address}`,
		`${address} World!`,
	];
	for (const text of validTexts) {
		expect(Chain.extractAddresses(text)).toEqual([address]);
	}

	// Contains two addresses
	validTexts = [
		`${address} ${address}`,
		`Hello! ${address} World! ${address}`,
		`${address} Hello! ${address}`,
		`${address} World! ${address}`,
	];
	for (const text of validTexts) {
		expect(Chain.extractAddresses(text)).toEqual([address, address]);
	}

	// Contains no address
	const invalidTexts = [
		"x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b564",
		"Hello! 0x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b56 World!",
		"Hello! 0x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b56401 World!",
	];
	for (const text of invalidTexts) {
		expect(Chain.extractAddresses(text)).toEqual([]);
	}
});

describe("sumAirDropAmounts works", async () => {
	const db = await new Database(AppDataSource).init();
	const identifier = "test-identifier";
	const address = "0x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b5640";

	beforeAll(async () => {
		// insert airdrop histories
		await db.makeTransaction(async (queryRunner) => {
			const histories = [
				new AirdropHistory(identifier, address, 0.1),
				new AirdropHistory(identifier, address, 1),
				new AirdropHistory(identifier, address, 10),
			];
			for (const history of histories) {
				await queryRunner.manager.insert(AirdropHistory, history);
			}
		});
	});

	afterAll(async () => {
		// delete airdrop histories
		await db.makeTransaction(async (queryRunner) => {
			await queryRunner.manager.delete(AirdropHistory, { identifier });
		});
	});

	test("none zero", async () => {
		const sum = await Chain.sumAirDropAmounts(db, identifier);
		expect(sum).toBe(11.1);
	});

	test("zero", async () => {
		const sum = await Chain.sumAirDropAmounts(db, "non-exist-identifier");
		expect(sum).toBe(0);
	});
});
