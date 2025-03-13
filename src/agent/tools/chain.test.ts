import { describe, expect, test } from "bun:test";
import { provider, sendEth, extractAddresses } from "./chain";

test("sendEth works", async () => {
	const to = "0x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b5640";
	await sendEth({ to, amountInEth: "0.1" });

	// confirm the balance of to is increased
	const balance = await provider.getBalance(to);
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
	validTexts.forEach((text) => {
		expect(extractAddresses(text)).toEqual([address]);
	});

	// Contains two addresses
	validTexts = [
		`${address} ${address}`,
		`Hello! ${address} World! ${address}`,
		`${address} Hello! ${address}`,
		`${address} World! ${address}`,
	];
	validTexts.forEach((text) => {
		expect(extractAddresses(text)).toEqual([address, address]);
	});

	// Contains no address
	const invalidTexts = [
		"x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b564",
		"Hello! 0x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b56 World!",
		"Hello! 0x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b56401 World!",
	];
	invalidTexts.forEach((text) => {
		expect(extractAddresses(text)).toEqual([]);
	});
})
