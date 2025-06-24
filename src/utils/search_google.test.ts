import { test } from "bun:test";
import { googleCustomSearch } from "./search_google";

// Basic test to ensure URL is constructed with provided parameters

test("googleCustomSearch works", async () => {
	const query = "What is tofuNFT?";
	const response = await googleCustomSearch(query);
	console.log(response);
});
