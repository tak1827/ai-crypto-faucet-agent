import { expect, test } from "bun:test";
import { Twitter } from "../twitter";
import {
	type ContentFetcher,
	extractArticleContent,
	fetchArticlesFromText,
	resolveShortUrl,
} from "./web";

test("extracts title and content from a real article", async () => {
	const url =
		"https://oasyswallet.zendesk.com/hc/en-us/articles/12578425563791-Campaign-Announcement-Oassy-hunt";
	const result = await extractArticleContent(url);
	console.log("Extracted article", result);

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
	const twitter = Twitter.create(false);
	const contentFetchers = new Map<string, ContentFetcher>();
	contentFetchers.set("twitter.com", twitter.tweetContentFetcher);
	contentFetchers.set("x.com", twitter.tweetContentFetcher);
	const text =
		"https://docs.oasys.games/docs/tech-docs/users/faq 🔥 AMA with Seraph x KAIB3K! 🔥\n Join us for an exciting game demo AMA with Seraph, and KAI: Battle of Three Kingdoms, 2 of the top games on BNB ecosystem!\n📅 June 16\n⏰ 12:00 UTC\n📍https://t.co/1KQb8dyKdW\n\nWe’re giving away 50 Da Qiao NFTs + 5 Seraph items (worth ~$50 each)! https://t.co/h5SkpZv8ES";
	const articles = await fetchArticlesFromText(text, contentFetchers);
	console.log("Fetched articles", articles);

	// expected 2, one is article, one is tweet, one is not a valid URL
	expect(articles.length).toBe(2);
	expect(articles[0]).toHaveProperty("title");
	expect(articles[0]).toHaveProperty("content");
});
