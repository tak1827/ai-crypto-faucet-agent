import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export const extractArticleContent = async (
	url: string,
): Promise<{
	title: string;
	content: string;
	publishedTime?: string | null;
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
		publishedTime: article.publishedTime || null,
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

const shortDomains = [
        "t.co",
        "bit.ly",
        "tinyurl.com",
        "goo.gl",
        "ow.ly",
        "is.gd",
        "buff.ly",
];

const isShortUrl = (url: string): boolean => {
        try {
                const { hostname } = new URL(url);
                return shortDomains.includes(hostname) || hostname.length <= 5;
        } catch {
                return false;
        }
};

export const fetchArticlesFromText = async (
        text: string,
): Promise<{
        title: string;
        content: string;
        publishedTime?: string | null;
}[]> => {
        const urlRegex = /https?:\/\/[^\s]+/g;
        const rawUrls = text.match(urlRegex) ?? [];

        const urls = await Promise.all(
                rawUrls.map(async (u) => (isShortUrl(u) ? await resolveShortUrl(u) : u)),
        );

        return Promise.all(urls.map((u) => extractArticleContent(u)));
};
