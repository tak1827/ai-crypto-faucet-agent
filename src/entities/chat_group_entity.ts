import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import type { Database } from "../db";
import type { ChatHistory } from "./chat_history_entity";

export type Chat = {
	id: string; // twitter id
	assistant?: string;
	user?: string;
	createdAt: Date;
	[key: string]: any;
};

export type LLMChat = { assistant: string; user?: never } | { user: string; assistant?: never };

@Entity()
export class ChatGroup {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column({ type: "varchar", length: 255 })
	groupId!: string; // X user id

	@Column({ type: "jsonb" })
	chats!: Chat[];

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;

	constructor(groupId: string, chats?: Chat[]) {
		this.groupId = groupId;
		this.chats = chats || [];
	}

	static groupIdFromUserIds(userIds: string[]) {
		return userIds.sort().join("-");
	}

	addChats(chats: Chat[]) {
		for (const chat of chats) {
			if (!chat.assistant && !chat.user) {
				throw new Error("history must have either assistant or user");
			}
		}
		this.chats.push(...this.#filterChatsUniqueById(chats));
	}

	addChatHistories(assistantId: string, histories: ChatHistory[]) {
		const chats: Chat[] = [];
		for (const history of histories) {
			const chat = {
				id: history.externalId,
				createdAt: history.createdAt,
			} as Chat;
			if (history.identifier === assistantId) chat.assistant = history.content;
			else chat.user = history.content;
			chats.push(chat);
		}
		this.chats.push(...this.#filterChatsUniqueById(chats));
	}

	getLLMChatHistories(limit?: number): LLMChat[] {
		const chats = this.chats.map((chat) => {
			if (chat.assistant) {
				return { assistant: chat.assistant };
			}
			if (chat.user) {
				return { user: chat.user };
			}
			throw new Error("history must have either assistant or user");
		});
		if (!limit) return chats; // return all chats
		if (chats.length <= limit) return chats; // return all chats if less than limit
		return chats.slice(chats.length - limit); // return last limit chats
	}

	#filterChatsUniqueById = (chats: Chat[]): Chat[] =>
		chats.filter((chat) => this.#findChat(chat.id) === null);

	#findChat(id: string): Chat | null {
		for (const chat of this.chats) {
			if (chat.id === id) return chat;
		}
		return null;
	}
}

export const getChatGroupByUserId = async (
	db: Database,
	userIds: string[],
): Promise<ChatGroup | null> => {
	let result: ChatGroup | null = null;
	await db.makeQuery(async (queryRunner) => {
		result = await queryRunner.manager.findOne(ChatGroup, {
			where: { groupId: ChatGroup.groupIdFromUserIds(userIds) },
		});
	});
	return result;
};
