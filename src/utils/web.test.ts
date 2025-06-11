import { expect, test } from "bun:test";
import {
        extractArticleContent,
        resolveShortUrl,
        fetchArticlesFromText,
} from "./web";

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

test("fetchArticlesFromText extracts all URLs", async () => {
        const text =
                "\ud83d\udd25 AMA with Seraph x KAIB3K! \ud83d\udd25\n Join us for an exciting game demo AMA with Seraph, and KAI: Battle of Three Kingdoms, 2 of the top games on BNB ecosystem!\n\ud83d\dccc June 16\n\u23f0 12:00 UTC\n\ud83d\udccdhttps://t.co/1KQb8dyKdW\n\nWe\u2019re giving away 50 Da Qiao NFTs + 5 Seraph items (worth ~$50 each)! https://t.co/h5SkpZv8ES";
        const articles = await fetchArticlesFromText(text);
        console.log(`Fetched articles`, articles);
        expect(articles.length).toBeGreaterThan(0);
        expect(articles[0]).toHaveProperty("title");
        expect(articles[0]).toHaveProperty("content");
});
