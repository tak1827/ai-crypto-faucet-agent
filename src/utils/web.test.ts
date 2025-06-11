import { expect, test } from "bun:test";
import { extractArticleContent } from './web';

test('extracts title and content from a real article', async () => {
  const url = 'https://oasyswallet.zendesk.com/hc/en-us/articles/12578425563791-Campaign-Announcement-Oassy-hunt';
  const result = await extractArticleContent(url);

  expect(result).toHaveProperty('title');
  expect(result.title.length).toBeGreaterThan(5);

  expect(result).toHaveProperty('content');
  expect(result.content.length).toBeGreaterThan(100); // reasonable article length

  expect(result).toHaveProperty('publishedTime');
});
