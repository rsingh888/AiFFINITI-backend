import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';
import { user } from './user';

export const postType = ['PhotoSlideShow', 'AiVideo'];

export const post = pgTable('post', {
  postId: uuid('post-id').defaultRandom().primaryKey(),

  userId: varchar('user-id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),

  postMediaUrl: varchar('post-media-url', { length: 1000 }),

  postType: varchar('post-type', { length: 255 }),

  isPublic: boolean('is-public').default(false),

  isDeleted: boolean('is-deleted').default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
