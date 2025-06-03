import type { Server } from "node:http";
import express from "express";
import type { auth } from "twitter-api-sdk";
import logger from "../utils/logger";
import { Twitter } from "./index";

export const startServer = (
	host: string,
	port: number,
	authClient: auth.OAuth2User,
	setRefreshTimeoutId: (id: Timer) => void,
): Server => {
	const app = express();
	const STATE = "my-state";
	const errHandler = (err: Error, res: express.Response) =>
		res.status(500).json({ error: err.message });

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
			Twitter.writeToFileAndRefleshToken(token, authClient, setRefreshTimeoutId);
			res.json({ access_token: token.access_token, expires_at: token.expires_at });
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
		logger.trace(`X Auth URL: ${authUrl}`);
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

	return app.listen(port, host, (err) => {
		if (err) {
			logger.error(err, `Error starting server on port ${port}, host ${host}`);
			throw err;
		}
		logger.info(`twitter server started! Go here to login: http://${host}:${port}/login`);
	});
};
