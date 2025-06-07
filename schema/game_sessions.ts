import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  varchar,
} from 'drizzle-orm/pg-core';
// import { user } from './user';
import { conversations } from './chatting_schemas';

export const GameSessionRequestStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const;

export const GameStatus = {
  NOT_STARTED: 'not-started',
  WAITING: 'waiting',
  STARTED: 'started',
  ENDED: 'ended',
} as const;

export const gameParticipants = pgTable('game-participants', {
  id: uuid('id').primaryKey().defaultRandom(),

  gameSessionId: uuid('game_session_id')
    .notNull()
    .references(() => gameSessions.id, { onDelete: 'cascade' }),

  participantId: varchar('participant_id', { length: 255 }).notNull(),
  // .references(() => user.id, { onDelete: 'cascade' }),

  score: numeric('score'),

  result: varchar('result', {
    enum: ['win', 'lose', 'draw'],
    length: 10,
  }),

  gameToken: text('game_token'),

  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const gameSessions = pgTable('game-sessions', {
  id: uuid('id').primaryKey().defaultRandom(),

  gameId: varchar('game_id', { length: 255 }).notNull(),

  requesterId: varchar('requester_id', { length: 255 }),
  // .notNull()
  // .references(() => user.id, { onDelete: 'cascade' }),

  acceptorId: varchar('acceptor_id', { length: 255 }),
  // .references(() => user.id, {
  //   onDelete: 'set null',
  // }),

  rejectorId: varchar('acceptor_id', { length: 255 }),
  // .references(() => user.id, {
  //   onDelete: 'set null',
  // }),

  requestedAt: timestamp('requested_at', { mode: 'date' })
    .defaultNow()
    .notNull(),
  acceptedAt: timestamp('accepted_at', { mode: 'date' }),
  rejectedAt: timestamp('rejected_at', { mode: 'date' }),

  gameStartedAt: timestamp('game_started_at', { mode: 'date' }),
  gameEndedAt: timestamp('game_ended_at', { mode: 'date' }),
  expectedGameEndTime: timestamp('expected_game_end_time', { mode: 'date' }),

  requestStatus: varchar('request_status', {
    enum: ['pending', 'accepted', 'rejected'],
    length: 20,
  })
    .notNull()
    .default('pending'),

  gameStatus: varchar('game_status', {
    enum: ['not-started', 'waiting', 'started', 'ended'],
    length: 20,
  })
    .notNull()
    .default('not-started'),

  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),

  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'set null' }),
});
