import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export const extractArticleContent = async (url: string): Promise<{
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
    title: article.title || '',
    content: article.textContent,
    publishedTime: article.publishedTime || null,
  };
}

