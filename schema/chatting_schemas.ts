// import {
//   pgTable,
//   uuid,
//   jsonb,
//   integer,
//   pgEnum,
//   timestamp,
// } from 'drizzle-orm/pg-core';

// const conversationTypeEnum = pgEnum('conversation_type', ['personal', 'group']);

// export const conversations = pgTable('conversations', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   type: conversationTypeEnum('type').notNull(),
//   lastMessageId: uuid('last_message_id'),
//   participants: jsonb('participants').$type<string[]>().notNull(),
//   unreadMessagesCount: integer('unread_messages_count').default(0).notNull(),
// });

// export const chat = pgTable('chat', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   type: conversationTypeEnum('type').notNull(), // could also be a message type if needed
//   senderId: uuid('sender_id').notNull(),
//   messageData: jsonb('message_data').notNull(), // flexible payload
//   createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
//   readAt: timestamp('read_at', { mode: 'date' }), // null if unread
//   conversationId: uuid('conversation_id').notNull(),
// });

import {
  pgTable,
  uuid,
  jsonb,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './user';
import { gameSessions } from './game_sessions';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
// import { user } from './user';

export const ConversationType = {
  PERSONAL: 'personal',
  //   GROUP = 'group',
  //   CHANNEL = 'channel',
} as const;

export const ChatMessageType = {
  TEXT: 'text',
  IMAGE: 'image',
  GAME: 'game',
  // GAME_REQUESTED: 'game-requested',
  // GAME_REQUEST_ACCEPTED: 'game-request-accepted',
  // GAME_REQUEST_REJECTED: 'game-request-rejected',
  // GAME_STARTED: 'game-started',
  // GAME_RESULT: 'game-result',
} as const;

export type ChatMessageTypeTypes =
  (typeof ChatMessageType)[keyof typeof ChatMessageType];

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 255 }).notNull(),
  lastMessageId: uuid('last_message_id'),
  participants: jsonb('participants').$type<string[]>().notNull(),
  // for example: [ "53ead17b-1e6a-46c9-bd5a-cb820f0ad0dd", "70acd124-d419-4344-a535-dcad51d40f82"]
});

export const chat = pgTable('chat', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 255 }).notNull(),
  senderId: varchar('sender_id', { length: 255 })
    .notNull()
    .references(() => user.id),
  message: text('message'),
  gameSessionId: uuid('game_id').references(() => gameSessions.id),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  readAt: timestamp('read_at', { mode: 'date' }),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id),
});

export type ISelectChat = InferSelectModel<typeof chat>;
export type IInsertChat = InferInsertModel<typeof chat>;
