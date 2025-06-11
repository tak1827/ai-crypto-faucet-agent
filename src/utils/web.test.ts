import { expect, test } from "bun:test";
import { extractArticleContent, resolveShortUrl } from "./web";

test("extracts title and content from a real article", async () => {
	const url =
		"https://oasyswallet.zendesk.com/hc/en-us/articles/12578425563791-Campaign-Announcement-Oassy-hunt";
	const result = await extractArticleContent(url);
	console.log(`Extracted article`, result);

	expect(result).toHaveProperty("title");
	expect(result.title.length).toBeGreaterThan(5);

	expect(result).toHaveProperty("content");
	expect(result.content.length).toBeGreaterThan(100); // reasonable article length

	expect(result).toHaveProperty("publishedTime");
});

test("resolveShortUrl expands t.co link", async () => {
	const shortUrl = "https://t.co/jkjL5ixOIl";
	const resolved = await resolveShortUrl(shortUrl);
	console.log(`Resolved URL: ${resolved}`);
	expect(resolved).not.toBe(shortUrl);
	expect(resolved.startsWith("https://")).toBe(true);
});
