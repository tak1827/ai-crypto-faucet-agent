import logger from "./logger";
import { sleep } from "./utils";

const retry = async <T>(
	leftAttemts: number,
	task: () => Promise<T>,
	sleepTime?: number,
): Promise<T> => {
	try {
		return await task();
	} catch (err) {
		const next = leftAttemts - 1;
		logger.debug(err, `retry failed, ${next} attempts left`);
		if (leftAttemts <= 0) {
			throw new Error(
				`retry failed, no attempts left. err: ${(err as Error).message}`,
			);
		}
		if (sleepTime) await sleep(sleepTime);
		return await retry(next, task);
	}
};

export default retry;
