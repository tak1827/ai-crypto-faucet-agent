import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { parseDateTime } from "./date";

export const extractArticleContent = async (
	url: string,
): Promise<{
	title: string;
	content: string;
	datetime?: Date;
}> => {
	// Fetch the HTML content from the URL
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}

	// Parse the HTML content
	const html = await response.text();
	const dom = new JSDOM(html, { url });
	const reader = new Readability(dom.window.document);
	const article = reader.parse();
	if (!article) {
		throw new Error(`Could not extract article content from ${url}`);
	}
	if (!article.textContent) {
		throw new Error(`No text content found in the article from ${url}`);
	}

	return {
		title: article.title || "",
		content: article.textContent,
		datetime: article.publishedTime ? parseDateTime(article.publishedTime) : undefined,
	};
};

export const resolveShortUrl = async (url: string): Promise<string> => {
	try {
		const response = await fetch(url, { redirect: "follow" });
		return response.url;
	} catch (err) {
		throw new Error(`Failed to resolve ${url}: ${(err as Error).message}`);
	}
};

const shortDomains = ["t.co", "bit.ly", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "buff.ly"];

export const isShortUrl = (url: string): boolean => {
	try {
		const { hostname } = new URL(url);
		return shortDomains.includes(hostname) || hostname.length <= 5;
	} catch {
		return false;
	}
};

export type ContentFetcher = (url: string) => Promise<{
	title: string;
	content: string;
	datetime?: Date;
}>;

export const fetchArticlesFromText = async (
	text: string,
	contentFetchers?: Map<string, ContentFetcher>, // map of hostname
): Promise<
	{
		title: string;
		content: string;
		datetime?: Date;
	}[]
> => {
	const urlRegex = /https?:\/\/[^\s]+/g;
	const rawUrls = text.match(urlRegex) ?? [];
	const results: { title: string; content: string; datetime?: Date }[] = [];
	for (const url of rawUrls) {
		try {
			const urlObj = isShortUrl(url) ? new URL(await resolveShortUrl(url)) : new URL(url);
			if (contentFetchers?.has(urlObj.hostname)) {
				const fetcher = contentFetchers.get(urlObj.hostname);
				if (fetcher) results.push(await fetcher(urlObj.toString()));
			} else {
				results.push(await extractArticleContent(urlObj.toString()));
			}
		} catch (err) {
			// skip the URL if any error occurs
			console.debug(`Failed to fetch content from ${url}: ${(err as Error).message}`);
		}
	}
	return results;
};
