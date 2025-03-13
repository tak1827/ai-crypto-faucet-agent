import { expect, test } from "bun:test";
import { provider, sendEth } from "./chain";

test("sendEth works", async () => {
	const to = "0x75fBB5Bd6FDf076Dcaf55243e9E3f3c76F8b5640";
	await sendEth({ to, amountInEth: "0.1" });

	// confirm the balance of to is increased
	const balance = await provider.getBalance(to);
	expect(balance).toBeGreaterThan(0);
});
