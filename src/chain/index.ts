import { type TransactionResponse, ethers } from "ethers";
import type { QueryRunner } from "typeorm";
import type { Database } from "../db";
import { AirdropHistory } from "../entities/airdrop_history_entity";
import { Env } from "../utils/env";

export type HashOrError = {
	hash?: string;
	err?: string;
};

export class Chain {
	provider: ethers.JsonRpcProvider;
	wallet: ethers.Wallet;
	contract: ethers.Contract;
	#blockConfirmations: number;

	constructor(opts: {
		privateKey: string;
		rpcUrl: string;
		erc20Address: string;
		blockConfirmations: number;
	}) {
		this.#blockConfirmations = opts.blockConfirmations;
		this.provider = new ethers.JsonRpcProvider(opts.rpcUrl);
		this.provider.getBlockNumber().catch((error) => {
			throw new Error(
				`Chain RPC is not reachable. rpcUrl: ${opts.rpcUrl}, err: ${error.message}`,
			);
		});
		this.wallet = new ethers.Wallet(opts.privateKey, this.provider);
		const erc20Abi = [
			"function transfer(address to, uint256 amount) public returns (bool)",
			"function decimals() public view returns (uint8)",
		];
		this.contract = new ethers.Contract(opts.erc20Address, erc20Abi, this.wallet);
	}

	static create(): Chain {
		const privateKey = Env.ethKey("CHAIN_PRIVATE_KEY");
		const rpcUrl = Env.string("CHAIN_RPC_URL");
		const erc20Address = Env.contractAddress("CHAIN_ERC20_CONTRACT_ADDRESS");
		const blockConfirmations = Env.number("CHAIN_BLOCK_CONFIRMATIONS");
		return new Chain({
			privateKey,
			rpcUrl,
			erc20Address,
			blockConfirmations,
		});
	}

	static extractAddresses(text: string): string[] {
		const addressRegex = /0x[a-fA-F0-9]{40}(?=\s|$)/g;
		const matches = text.match(addressRegex);
		return matches ? matches : [];
	}

	static containsEthAddress = (text: string): boolean => {
		const ethAddressRegex = /0x[a-fA-F0-9]{40}/;
		return ethAddressRegex.test(text);
	};

	static async sumAirDropAmounts(db: Database, identifier: string): Promise<number> {
		let sum = 0;
		await db.makeQuery(async (queryRunner: QueryRunner) => {
			const histories = await queryRunner.manager.find(AirdropHistory, {
				where: { identifier },
			});
			if (histories.length === 0) return;
			sum = histories.reduce((sum, history) => sum + Number(history.amount), 0);
		});
		return sum;
	}

	public async sendEth(to: string, amountInEth: string): Promise<HashOrError> {
		if (!ethers.isAddress(to)) {
			return { err: "Invalid format of recipient address" };
		}
		const amountInWei = ethers.parseEther(amountInEth);
		const tx = { to, value: amountInWei };
		const txRespPromise = this.wallet.sendTransaction(tx);
		return this.#handleTxResp(txRespPromise);
	}

	public async transferERC20(to: string, amount: string): Promise<HashOrError> {
		if (!ethers.isAddress(to)) {
			return { err: "Invalid format of recipient address" };
		}
		const decimals = await this.contract.decimals?.();
		const amountInSmallestUnit = ethers.parseUnits(amount, decimals);
		const txRespPromise = this.contract.transfer?.(to, amountInSmallestUnit);
		return this.#handleTxResp(txRespPromise as Promise<TransactionResponse>);
	}

	async #handleTxResp(txRespPromise: Promise<TransactionResponse>): Promise<HashOrError> {
		const result = {} as HashOrError;
		try {
			const txResp = await txRespPromise;
			const receipt = await txResp.wait(this.#blockConfirmations);
			if (!receipt || receipt.status === 0) {
				throw new Error("no receipt or unknown reason");
			}
			result.hash = receipt.hash;
		} catch (err) {
			result.err = `Failed to send transaction. error: ${(err as Error).message}`;
		}
		return result;
	}
}
