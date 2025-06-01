export const randSelect = <T>(arr: T[]): T => {
	if (arr.length === 0) throw new Error("cannot select randomly from an empty array");
	const randomIndex = Math.floor(Math.random() * arr.length);
	return arr[randomIndex] as T;
};
