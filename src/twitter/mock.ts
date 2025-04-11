import type { ResGetTweetReplies } from "./index";

export class mockTwitter {
	#createTweetCounter = 0;
	async createTweet(text: string, covId: string): Promise<{ id: string }> {
		this.#createTweetCounter++;
		return { id: `mock-tweet-${this.#createTweetCounter}` };
	}
	#resGetTweetReplies: ResGetTweetReplies | undefined;
	setResGetTweetReplies(res: ResGetTweetReplies) {
		this.#resGetTweetReplies = res;
	}
	async getTweetReplies(tweetIds: string[], nextToken?: string): Promise<ResGetTweetReplies> {
		if (!this.#resGetTweetReplies) throw new Error("getTweetReplies not set");
		return this.#resGetTweetReplies;
	}
	#resGetTweets: Map<string, { id: string; content: string }[]> = new Map();
	setResGetTweets(userId: string, res: { id: string; content: string }[]) {
		this.#resGetTweets.set(userId, res);
	}
	async getTweets(
		userId: string,
		opts?: { maxResults?: number; sinceId?: string; startTime?: string },
	): Promise<{ id: string; content: string }[]> {
		return this.#resGetTweets.get(userId) || [];
	}
	async likeTweet(userId: string, tweetId: string): Promise<boolean> {
		return true;
	}
}
