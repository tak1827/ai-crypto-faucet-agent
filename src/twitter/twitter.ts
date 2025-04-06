import type { Server } from "node:http";
import { Client, auth } from "twitter-api-sdk";
import { Env } from "../utils/env";
import logger from "../utils/logger";
import { startServer } from "./server";

export class Twitter {
	#authClient: auth.OAuth2User | undefined;
	#bearAuthClient: auth.OAuth2Bearer | undefined;
	#port = 3000;
	#server: Server | undefined;
	#tokenRefreshTimeout: NodeJS.Timer | undefined;
	#ownId: string | undefined;
	client: Client;

	constructor(opts: {
		bearerToken?: string;
		clientId?: string;
		clientSecret?: string;
		callbackURL?: string;
		ownId?: string;
		port?: number;
	}) {
		if (opts.clientId && opts.clientSecret && opts.callbackURL) {
			this.#authClient = new auth.OAuth2User({
				client_id: opts.clientId,
				client_secret: opts.clientSecret,
				callback: opts.callbackURL,
				scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
			});
			this.client = new Client(this.#authClient);
		} else if (opts.bearerToken) {
			this.#bearAuthClient = new auth.OAuth2Bearer(opts.bearerToken);
			this.client = new Client(this.#bearAuthClient);
		} else {
			throw new Error(
				"set clientId, clientSecret and callbackURL or bearerToken",
			);
		}
		if (opts.ownId) {
			this.#ownId = opts.ownId;
		}
		if (opts.port) {
			this.#port = opts.port;
		}
	}

	static create(port?: number): Twitter {
		const bearerToken = Env.string("X_BEARER_TOKEN");
		const clientId = Env.string("X_CLIENT_ID");
		const clientSecret = Env.string("X_CLIENT_SECRET");
		const callbackURL = Env.string("X_CALLBACK_URL");
		const ownId = Env.string("X_OWN_ID");
		return new Twitter({
			bearerToken,
			clientId,
			clientSecret,
			callbackURL,
			ownId,
			port,
		});
	}

	startOAuthServer() {
		if (!this.#authClient) {
			throw new Error("Auth client is not initialized");
		}
		this.#server = startServer(this.#port, this.#authClient, (id: Timer) => {
			this.#tokenRefreshTimeout = id;
		});
	}

	async close() {
		if (this.#tokenRefreshTimeout) {
			clearTimeout(this.#tokenRefreshTimeout);
			logger.info("token refresh timeout cleared");
		}
		if (this.#server) {
			const waitClosed = new Promise<void>((resolve) => {
				logger.info(`closing server on port ${this.#port}`);
				this.#server?.close((err?: Error) => {
					if (err) logger.error(err, "Server close with error");
					else logger.info("Server closed");
					resolve();
				});
			});
			await waitClosed;
		}
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

	getOwnId(): string {
		if (!this.#ownId) {
			throw new Error("User id is not set");
		}
		return this.#ownId;
	}

	async getTweets(
		userId: string,
		opts?: { maxResults?: number; sinceId?: string; startTime?: string },
	): Promise<{ id: string; content: string }[]> {
		const resp = await this.client.tweets.usersIdTweets(userId, {
			exclude: ["replies", "retweets"],
			max_results: opts?.maxResults,
			since_id: opts?.sinceId,
			start_time: opts?.startTime,
		});
		console.log(resp);
		this.#handleRespErr(resp, `failed to get tweets by user id: ${userId}`);
		if (!resp.data) return [];

		const tweets: { id: string; content: string }[] = [];
		for (const item of resp.data) {
			tweets.push({ id: item.id, content: item.text });
		}
		return tweets;
	}

	async createTweet(text: string): Promise<{ id: string; content: string }> {
		const resp = await this.client.tweets.createTweet({ text });
		this.#handleRespErr(resp, "failed to create tweet");
		return { id: resp.data?.id || "", content: resp.data?.text || "" };
	}

	async likeTweet(userId: string, tweetId: string): Promise<boolean> {
		const resp = await this.client.tweets.usersIdLike(userId, {
			tweet_id: tweetId,
		});
		this.#handleRespErr(resp, `failed to like tweet. userId: ${userId}`);
		return resp.data?.liked || false;
	}

	async retweet(userId: string, tweetId: string): Promise<boolean> {
		const resp = await this.client.tweets.usersIdRetweets(userId, {
			tweet_id: tweetId,
		});
		this.#handleRespErr(resp, `failed to retweet tweet. userId: ${userId}`);
		return resp.data?.retweeted || false;
	}

	async listFollowers(
		userId: string,
		paginationToken?: string,
	): Promise<{ userIds: string[]; nextToken: string }> {
		const resp = await this.client.users.usersIdFollowers(userId, {
			max_results: 100,
			pagination_token: paginationToken,
		});
		this.#handleRespErr(resp, `failed to list followers. userId: ${userId}`);

		const userIds: string[] = [];
		const nextToken = resp.meta?.next_token || "";
		if (!resp.data) return { userIds, nextToken };

		for (const user of resp.data) {
			userIds.push(user.id);
		}
		return { userIds, nextToken };
	}

	async getTweetReplies(
		tweetIds: string[],
		nextToken?: string,
	): Promise<{
		nextToken: string;
		replies: {
			tweetId: string;
			userId: string;
			covId: string;
			content: string;
		}[];
	}> {
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

		const resp = await this.client.tweets.tweetsRecentSearch({
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
}
