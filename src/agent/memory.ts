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

	async add(userId1: string, userId2: string, content: string, externalId: string) {
		const chatHistory = new ChatHistory(userId1, externalId, content);
		const chatGroup = await this.#getChatGroups(userId1 === this.ownId ? userId2 : userId1);
		chatGroup.addChatHistories(this.ownId, [chatHistory]);

		this.#changes.set(externalId, chatHistory);
		this.#changes.set(chatGroup.groupId, chatGroup);
	}

	async getLLMChatHistories(userId: string, limit = 8): Promise<LLMChat[]> {
		const chatGroup = await this.#getChatGroups(userId);
		return chatGroup.getLLMChatHistories(limit);
	}

	async commit(): Promise<void> {
		const entities = Array.from(this.#changes.values());
		await this.#db.saveEntities(entities);
		this.#changes.clear();
	}

	#gId(userId: string): string {
		return ChatGroup.groupIdFromUserIds([this.ownId, userId]);
	}

	async #getChatGroups(userId: string): Promise<ChatGroup> {
		const gId = this.#gId(userId);
		let chatGroup = this.#chatGroups.get(gId);
		if (chatGroup) {
			// Found in memory
			return chatGroup;
		}

		// Not found in memory, so fetch from DB, otherwise create a new one
		chatGroup =
			(await getChatGroupByUserId(this.#db, [this.ownId, userId])) || new ChatGroup(gId);
		this.#chatGroups.set(gId, chatGroup);
		return chatGroup;
	}
}
