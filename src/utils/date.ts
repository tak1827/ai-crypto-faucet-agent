export const parseDateTime = (input: string): Date | undefined => {
	const date = new Date(input);
	return Number.isNaN(date.getTime()) ? undefined : date;
};
