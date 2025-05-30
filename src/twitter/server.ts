import type { Server } from "node:http";
import express from "express";
import type { auth } from "twitter-api-sdk";
import { writeToFile } from "../utils/file";
import logger from "../utils/logger";
import { type Token, oauthFilePath } from "./index";

export const startServer = (
	port: number,
	authClient: auth.OAuth2User,
	setRefreshTimeoutId: (id: Timer) => void,
): Server => {
	const app = express();
	const STATE = "my-state";
	const errHandler = (err: Error, res: express.Response) =>
		res.status(500).json({ error: err.message });
	const refleshTokenBeforeExpire = (expireAt: number) => {
		const timeoutAt = expireAt - Date.now() - 60 * 1000;
		if (timeoutAt < 0) {
			throw new Error(`expireAt is invalid: ${expireAt}`);
		}
		const timeout = setTimeout(async () => {
			const { token } = await authClient.refreshAccessToken();
			if (token.expires_at) {
				logger.info(
					`Access token refreshed successfully, expires at ${new Date(token.expires_at).toUTCString()}`,
				);
				refleshTokenBeforeExpire(token.expires_at);
			}
		}, timeoutAt);
		setRefreshTimeoutId(timeout);
	};
	const writeOAuthToFile = (token: Token) => writeToFile(oauthFilePath(), token);

	app.get("/callback", async (req, res): Promise<void> => {
		logger.info("/callback called");
		try {
			const { code, state } = req.query;
			if (state !== STATE) {
				const err = new Error(`State isn't matching. expected: ${STATE}, got: ${state}`);
				errHandler(err, res);
				return;
			}
			const { token } = await authClient.requestAccessToken(code as string);
			writeOAuthToFile(token);
			if (token.expires_at) refleshTokenBeforeExpire(token.expires_at);
			const { access_token, refresh_token, expires_at } = token;
			res.json({ access_token, refresh_token, expires_at });
		} catch (error) {
			logger.error(error, "Error requesting access token");
			errHandler(error as Error, res);
			return;
		}
	});

	app.get("/login", async (req, res): Promise<void> => {
		logger.info("/login called");
		const authUrl = authClient.generateAuthURL({
			state: STATE,
			code_challenge_method: "s256",
		});
		logger.debug(`X Auth URL: ${authUrl}`);
		res.redirect(authUrl);
	});

	app.get("/logout", async (req, res): Promise<void> => {
		logger.info("/revoke called");
		try {
			const response = await authClient.revokeAccessToken();
			res.send(response);
		} catch (err) {
			logger.error(err, "Error revoking access token");
			errHandler(err as Error, res);
			return;
		}
	});

	// app.get("/token", async (req, res): Promise<void> => {
	// 	logger.info("/token called");
	// 	if (!authClient.token) {
	// 		res.send("No token");
	// 		return;
	// 	}
	// 	const { access_token, refresh_token, expires_at} = authClient.token;
	// 	res.json({ access_token, refresh_token, expires_at });
	// })

	return app.listen(port, (err) => {
		if (err) {
			logger.error(err, `Error starting server on port ${port}`);
			throw err;
		}
		logger.info(`Server started! Go here to login: http://127.0.0.1:${port}/login`);
	});
};
