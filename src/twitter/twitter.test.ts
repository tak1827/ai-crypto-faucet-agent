import { expect, test } from "bun:test";
import { Twitter } from "./twitter";

test("Twitter works", async () => {
	const userId = "1484355185887834112";
	const twitter = Twitter.create();

	twitter.startOAuthServer();
	const token = await twitter.waitLogin();
	console.log("token", token);

	try {
		const tweets = await twitter.getTweets(userId);
		console.log("tweets", tweets);
		expect(tweets.length).toBeGreaterThan(0);
	} catch (err: any) {
		// expect too many requests error
		if (!err.status) throw err;
		expect(err.status).toBe(429);
	}

	await twitter.close();
});
