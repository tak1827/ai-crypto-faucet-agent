import type { Server } from "node:http";
import { resolve } from "node:path";
import { Client, auth } from "twitter-api-sdk";
import type { TwitterResponse, usersIdRetweets } from "twitter-api-sdk/dist/types";
import { Env } from "../utils/env";
import { readFromFile, writeToFile } from "../utils/file";
import logger from "../utils/logger";
import { sleepCancelable } from "../utils/sleep";
import { startServer } from "./server";

export class Twitter {
	#authClient: auth.OAuth2User | undefined;
	#bearAuthClient: auth.OAuth2Bearer | undefined;
	#host = "127.0.0.1";
	#port = 3000;
	#server: Server | undefined;
	#tokenRefreshTimeout: NodeJS.Timer | undefined;
	#clearRateLimitTimer: (() => void) | undefined;
	#closing = false;
	ownId: string | undefined;
	client: Client;

	static readonly MAX_TWEET_LENGTH = 280;

	constructor(opts: {
		bearerToken?: string;
		clientId?: string;
		clientSecret?: string;
		callbackURL?: string;
		ownId?: string;
		host?: string;
		port?: number;
	}) {
		if (opts.clientId && opts.clientSecret && opts.callbackURL) {
			const token = this.#readOAuthTokenFromFile();
			this.#authClient = new auth.OAuth2User({
				client_id: opts.clientId,
				client_secret: opts.clientSecret,
				callback: opts.callbackURL,
				scopes: ["tweet.read", "tweet.write", "like.write", "users.read", "offline.access"],
				token,
			});
			this.client = new Client(this.#authClient);
			if (token) {
				Twitter.writeToFileAndRefleshToken(
					token,
					this.#authClient,
					this.setTokenRefreshTimeoutId,
				);
			}
		} else if (opts.bearerToken) {
			this.#bearAuthClient = new auth.OAuth2Bearer(opts.bearerToken);
			this.client = new Client(this.#bearAuthClient);
		} else {
			throw new Error("set clientId, clientSecret and callbackURL or bearerToken");
		}
		if (opts.ownId) this.ownId = opts.ownId;
		if (opts.host) this.#host = opts.host;
		if (opts.port) this.#port = opts.port;
	}

	static create(): Twitter {
		const bearerToken = Env.string("X_BEARER_TOKEN");
		const clientId = Env.string("X_CLIENT_ID");
		const clientSecret = Env.string("X_CLIENT_SECRET");
		const callbackURL = Env.string("X_CALLBACK_URL");
		const ownId = Env.string("X_OWN_ID");
		const host = Env.string("X_SERVER_HOST");
		const port = Env.number("X_SERVER_PORT");
		return new Twitter({
			bearerToken,
			clientId,
			clientSecret,
			callbackURL,
			ownId,
			host,
			port,
		});
	}

	setTokenRefreshTimeoutId = (id: Timer) => {
		this.#tokenRefreshTimeout = id;
	};

	startOAuthServer(): Twitter {
		if (!this.#authClient) {
			throw new Error("Auth client is not initialized");
		}
		this.#server = startServer(
			this.#host,
			this.#port,
			this.#authClient,
			this.setTokenRefreshTimeoutId,
		);
		return this;
	}

	async close() {
		this.#closing = true;
		if (this.#tokenRefreshTimeout !== undefined) {
			clearTimeout(this.#tokenRefreshTimeout);
			logger.info("token refresh timeout cleared");
			this.#tokenRefreshTimeout = undefined; // reset the timeout
		}
		if (this.#clearRateLimitTimer !== undefined) {
			this.#clearRateLimitTimer();
			logger.info("rate limit timer cleared");
			this.#clearRateLimitTimer = undefined; // reset the timer
		}
		if (this.#server) {
			const waitClosed = new Promise<void>((resolve) => {
				logger.info(`closing twitter server on port ${this.#port}`);
				this.#server?.close((err?: Error) => {
					if (err) logger.error(err, "twitter server close with error");
					else logger.info("twitter server closed");
					resolve();
				});
			});
			await waitClosed;
		}
		this.#closing = false; // reset the closing state
	}

	getAccessToken(): { accessToken: string; refreshToken: string } | null {
		if (!this.#authClient) {
			throw new Error("Auth client is not initialized");
		}
		if (!this.#authClient.token) return null;
		return {
			accessToken: this.#authClient.token.access_token || "",
			refreshToken: this.#authClient.token.refresh_token || "",
		};
	}

	async waitLogin(): Promise<{ accessToken: string; refreshToken: string }> {
		if (!this.#authClient) {
			throw new Error("Auth client is not initialized");
		}
		return new Promise((resolve) => {
			const interval = setInterval(() => {
				const token = this.getAccessToken();
				if (token) {
					clearInterval(interval);
					resolve(token);
				}
			}, 1000);
		});
	}

	// 5 requests / 15 mins PER USER 10 requests / 15 mins PER APP
	async getTweets(
		userId: string,
		opts?: { maxResults?: number; sinceId?: string; startTime?: string },
	): Promise<{ id: string; content: string }[]> {
		const pages = this.client.tweets.usersIdTweets(userId, {
			exclude: ["replies", "retweets"],
			max_results: opts?.maxResults || 5, // between 5 and 100
			since_id: opts?.sinceId,
			start_time: opts?.startTime,
		});
		const firstPage = await this.#handleRatelimit(() => pages[Symbol.asyncIterator]().next());
		const resp = firstPage.value;
		this.#handleRespErr(resp, `failed to get tweets by user id: ${userId}`);
		if (!resp.data) return [];

		const tweets: { id: string; content: string }[] = [];
		for (const item of resp.data) {
			tweets.push({ id: item.id, content: item.text });
		}
		return tweets;
	}

	// 100 requests / 24 hours PER USER 1667 requests / 24 hours PER APP
	async createTweet(text: string, tweetId?: string): Promise<{ id: string; content: string }> {
		if (text.length > Twitter.MAX_TWEET_LENGTH) {
			throw new Error(
				`Tweet content is too long: ${text.length} characters, max is ${Twitter.MAX_TWEET_LENGTH}.`,
			);
		}

		const resp = await this.#handleRatelimit(() =>
			this.client.tweets.createTweet({
				text,
				reply: tweetId ? { in_reply_to_tweet_id: tweetId } : undefined,
			}),
		);
		this.#handleRespErr(resp, "failed to create tweet");
		return { id: resp.data?.id || "", content: resp.data?.text || "" };
	}

	// 100 requests / 24 hours PER USER
	async likeTweet(tweetId: string): Promise<boolean> {
		if (!this.ownId) throw new Error("ownId is not set, cannot like tweet");
		const resp = await this.#handleRatelimit(() =>
			this.client.tweets.usersIdLike(this.ownId || "", {
				tweet_id: tweetId,
			}),
		);
		this.#handleRespErr(resp, `failed to like tweet. tweetId: ${tweetId}`);
		return resp.data?.liked || false;
	}

	// 5 requests / 15 mins PER USER
	async retweet(userId: string, tweetId: string): Promise<boolean> {
		const resp = await this.#handleRatelimit<TwitterResponse<usersIdRetweets>>(() =>
			this.client.tweets.usersIdRetweets(userId, {
				tweet_id: tweetId,
			}),
		);
		this.#handleRespErr(resp, `failed to retweet tweet. userId: ${userId}`);
		return resp.data?.retweeted || false;
	}

	// NOTE: mistake in `usersIdFollowing`?
	async listFollowers(
		userId: string,
		paginationToken?: string,
	): Promise<{ userIds: string[]; nextToken: string }> {
		const pages = this.client.users.usersIdFollowers(userId, {
			max_results: 100,
			pagination_token: paginationToken,
		});
		const firstPage = await this.#handleRatelimit(() => pages[Symbol.asyncIterator]().next());
		const resp = firstPage.value;
		this.#handleRespErr(resp, `failed to list followers. userId: ${userId}`);

		const userIds: string[] = [];
		const nextToken = resp.meta?.next_token || "";
		if (!resp.data) return { userIds, nextToken };

		for (const user of resp.data) {
			userIds.push(user.id);
		}
		return { userIds, nextToken };
	}

	// 60 requests / 15 mins PER USER 60 requests / 15 mins PER APP
	async getTweetReplies(tweetIds: string[], nextToken?: string): Promise<ResGetTweetReplies> {
		const result = {
			nextToken: "",
			replies: [] as {
				tweetId: string;
				userId: string;
				covId: string;
				content: string;
			}[],
		};

		// The first tweet's id is also its conversation_id, so no need to get it
		// if (!convId) {
		// 	const tweet = await this.client.tweets.findTweetById(tweetId);
		// 	this.#handleRespErr(tweet, `failed to find tweet by id: ${tweetId}`);
		// 	result.conversationId = tweet.data?.conversation_id || "";
		// }

		const pages = this.client.tweets.tweetsRecentSearch({
			query: tweetIds.map((id) => `conversation_id:${id}`).join(" OR "),
			"tweet.fields": [
				"in_reply_to_user_id", // my id
				"author_id", // user's id
				"created_at",
				"conversation_id",
			],
			max_results: 100,
			next_token: nextToken,
		});
		const firstPage = await this.#handleRatelimit(() => pages[Symbol.asyncIterator]().next());
		const resp = firstPage.value;
		this.#handleRespErr(resp, `failed to get replies of tweets: ${tweetIds}`);
		result.nextToken = resp.meta?.next_token || "";
		if (!resp.data) return result;

		for (const tweet of resp.data) {
			result.replies.push({
				tweetId: tweet.id || "",
				userId: tweet.author_id || "",
				covId: tweet.conversation_id || "",
				content: tweet.text,
			});
		}
		return result;
	}

	#handleRespErr(resp: { errors?: any }, errMsg: string) {
		if (!resp.errors) return;
		throw new Error(`${errMsg}. err: ${JSON.stringify(resp.errors)}`);
	}

	async #handleRatelimit<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				return await fn();
			} catch (err: any) {
				// Check for rate limit error (HTTP 429)
				if (err.status && err.status === 429) {
					const resetHeader = err.headers["x-rate-limit-reset"];
					if (resetHeader) {
						const resetTime = Number(resetHeader) * 1000; // Convert to ms
						const waitTime = resetTime - Date.now();
						if (waitTime > 0) {
							logger.info(
								`twitter api rate limit hit. Waiting for ${Math.ceil(waitTime / 1000)} sec.`,
							);

							try {
								await sleepCancelable(waitTime, (clearTimer: () => void) => {
									this.#clearRateLimitTimer = clearTimer; // set clear timer
								});
							} catch (err) {
								if (this.#closing) throw new Error(`closing!, cannot retry ${fn.name}`);
								throw err;
							}
							continue;
						}
					}
				}
				// For other errors or if no reset header, rethrow
				throw err;
			}
		}
		throw new Error(`max retries reached for ${fn.name}, maxRetries: ${maxRetries}`);
	}

	#readOAuthTokenFromFile(): Token | undefined {
		const token = readFromFile<Token>(Twitter.oauthFilePath());
		if (token?.expires_at && token.expires_at > Date.now()) {
			logger.info(`OAuth token read from file: ${JSON.stringify(token)}`);
			return token;
		}
		return undefined;
	}

	static oauthFilePath = () => resolve(Env.path("DIR_TWITTER"), "oauth.json");

	static writeOAuthToFile(token: Token) {
		logger.info(`OAuth token write to file: ${JSON.stringify(token)}`);
		writeToFile(Twitter.oauthFilePath(), token);
	}

	static writeToFileAndRefleshToken(
		token: Token,
		authClient: auth.OAuth2User,
		setTimeoutId: (id: Timer) => void,
	) {
		// First, write the token to file
		Twitter.writeOAuthToFile(token);

		if (token.expires_at === undefined) return;

		// Set a timeout to refresh the token before it expires
		const timeoutAt = token.expires_at - Date.now() - 60 * 1000;
		if (timeoutAt < 0) throw new Error(`expireAt is invalid: ${token.expires_at}`);
		const timeout = setTimeout(async () => {
			const { token } = await authClient.refreshAccessToken();
			Twitter.writeToFileAndRefleshToken(token, authClient, setTimeoutId);
		}, timeoutAt);
		setTimeoutId(timeout);
		logger.info(
			`Set token refresh timeout. expires at: ${new Date(token.expires_at).toUTCString()}`,
		);
	}

	static getTweetUrl(userId: string, tweetId: string): string {
		return `https://x.com/${userId}/status/${tweetId}`;
	}
}

export type ResGetTweetReplies = {
	nextToken: string;
	replies: {
		tweetId: string;
		userId: string;
		covId: string;
		content: string;
	}[];
};

// Copied from twitter-api-sdk
export type Token = {
	/** Allows an application to obtain a new access token without prompting the user via the refresh token flow. */
	refresh_token?: string;
	/** Access tokens are the token that applications use to make API requests on behalf of a user.  */
	access_token?: string;
	token_type?: string;
	/** Comma-separated list of scopes for the token  */
	scope?: string;
	expires_at?: number;
};
