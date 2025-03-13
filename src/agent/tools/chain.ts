import { type TransactionResponse, ethers } from "ethers";
import type { JSONValue } from "llamaindex";
import { Env } from "../utils/env";

const privateKey = Env.ethKey("CHAIN_PRIVATE_KEY");
const rpcUrl = Env.string("CHAIN_RPC_URL");
const erc20Address = Env.contractAddress("CHAIN_ERC20_CONTRACT_ADDRESS");
const blockConfirmations = Env.number("CHAIN_BLOCK_CONFIRMATIONS");

// Create provider checking if the RPC URL is reachable
const provider = (() => {
	const provider = new ethers.JsonRpcProvider(rpcUrl);
	provider.getBlockNumber().catch((error) => {
		throw new Error(
			`Chain RPC is not reachable. rpcUrl: ${rpcUrl}, err: ${error.message}`,
		);
	});
	return provider;
})();
const wallet = new ethers.Wallet(privateKey, provider);
const erc20Abi = [
	// transfer function
	"function transfer(address to, uint256 amount) public returns (bool)",
	// decimals function
	"function decimals() public view returns (uint8)",
];
const contract = new ethers.Contract(erc20Address, erc20Abi, wallet);

export { provider, wallet, contract };

export async function sendEth({
	to,
	amountInEth,
}: { to: string; amountInEth: string }): Promise<JSONValue> {
	// Convert ETH amount to Wei
	const amountInWei = ethers.parseEther(amountInEth);

	const tx = { to, value: amountInWei };
	const txRespPromise = wallet.sendTransaction(tx);
	return handleTxRespForAgent(txRespPromise);
}

export async function transferERC20({
	to,
	amount,
}: { to: string; amount: string }): Promise<JSONValue> {
	// Convert amount to token's smallest unit
	const decimals = await contract.decimals?.();
	const amountInSmallestUnit = ethers.parseUnits(amount, decimals);

	const txRespPromise = contract.transfer?.(to, amountInSmallestUnit);
	return handleTxRespForAgent(txRespPromise as Promise<TransactionResponse>);
}

const handleTxRespForAgent = async (
	txRespPromise: Promise<TransactionResponse>,
): Promise<JSONValue> => {
	let response: JSONValue;
	try {
		const txResp = await txRespPromise;
		const receipt = await txResp.wait(blockConfirmations);
		if (!receipt || receipt.status === 0) {
			throw new Error("no receipt or status is 0");
		}
		response = `Successfully sent transaction: ${receipt?.hash}`;
	} catch (err) {
		response = `Failed to send transaction. error: ${(err as Error).message}`;
	}
	return response;
};
