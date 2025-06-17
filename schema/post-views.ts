import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './user';
import { post } from './post';

export const postViews = pgTable(
  'post-views',
  {
    postId: uuid('post-id')
      .notNull()
      .references(() => post.postId, { onDelete: 'cascade' }),

    userId: varchar('user-id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created-at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    uniquePostView: unique().on(table.postId, table.userId), // prevent duplicate views per user
  }),
);
