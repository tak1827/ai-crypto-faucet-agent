export const containsEthAddress = (text: string): boolean => {
	const ethAddressRegex = /0x[a-fA-F0-9]{40}/;
	return ethAddressRegex.test(text);
};

export const extractEthAddress = (text: string): string | null => {
	const ethAddressRegex = /0x[a-fA-F0-9]{40}/;
	const match = text.match(ethAddressRegex);
	return match ? match[0] : null;
};
