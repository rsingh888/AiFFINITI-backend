import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const connectionRequest = pgTable('connection-request', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: varchar('requester-id', { length: 255 }),
  receiverId: varchar('receiver-id', { length: 255 }),
  status: varchar('status', { length: 255 }).default('pending'),
  type: varchar('type', { length: 255 }),
  createdAt: timestamp('created-at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated-at', { withTimezone: true }).defaultNow(),
});
