import e from "express";
import type { Database } from "../db";
import { ChatGroup, type LLMChat, getChatGroupByUserId } from "../entities/chat_group_entity";
import { ChatHistory } from "../entities/chat_history_entity";
import { Env } from "../utils/env";

export class Memory {
	ownId: string;
	#db: Database;
	#chatGroups: Map<string, ChatGroup>;
	#changes: Map<string, any>;

	constructor(db: Database, ownId: string) {
		this.#db = db;
		this.ownId = ownId;
		this.#chatGroups = new Map();
		this.#changes = new Map();
	}

	static create(db: Database, ownId?: string): Memory {
		return new Memory(db, ownId || Env.string("X_OWN_ID"));
	}

	async add(
		userId1: string,
		content: string,
		externalId: string,
		opts?: { userId2?: string; referenceId?: string },
	): Promise<void> {
		const chatHistory = opts?.referenceId
			? new ChatHistory(userId1, externalId, content, opts.referenceId)
			: new ChatHistory(userId1, externalId, content);
		this.#changes.set(externalId, chatHistory);

		if (opts?.userId2) {
			const chatGroup = await this.#getChatGroups([userId1, opts.userId2]);
			chatGroup.addChatHistories(this.ownId, [chatHistory]);
			this.#changes.set(chatGroup.groupId, chatGroup);
		}
	}

	addChatHistories(userId: string, chatHistories: ChatHistory[]) {
		const chatGroup = this.#chatGroups.get(userId);
		if (chatGroup) {
			chatGroup.addChatHistories(this.ownId, chatHistories);
			this.#changes.set(chatGroup.groupId, chatGroup);
		} else {
			const newChatGroup = new ChatGroup(userId);
			newChatGroup.addChatHistories(this.ownId, chatHistories);
			this.#changes.set(userId, newChatGroup);
		}
	}

	async getLLMChatHistories(userIds: string[], limit = 8): Promise<LLMChat[]> {
		const chatGroup = await this.#getChatGroups(userIds);
		return chatGroup.getLLMChatHistories(limit);
	}

	async commit(): Promise<void> {
		const entities = Array.from(this.#changes.values());
		await this.#db.saveEntities(entities);
		this.#changes.clear();
	}

	async #getChatGroups(userIds: string[]): Promise<ChatGroup> {
		const groupId = ChatGroup.groupIdFromUserIds(userIds);
		let chatGroup = this.#chatGroups.get(groupId);
		if (chatGroup) {
			// Found in memory
			return chatGroup;
		}

		// Not found in memory, so fetch from DB, otherwise create a new one
		chatGroup = (await getChatGroupByUserId(this.#db, userIds)) || new ChatGroup(groupId);
		this.#chatGroups.set(groupId, chatGroup);
		return chatGroup;
	}
}
