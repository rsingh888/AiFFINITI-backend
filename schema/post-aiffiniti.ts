import {
  pgTable,
  uuid,
  timestamp,
  primaryKey,
  varchar,
} from 'drizzle-orm/pg-core';
import { post } from './post';
import { user } from './user';

export const postAiffinities = pgTable(
  'post-affinities',
  {
    postId: uuid('post-id')
      .notNull()
      .references(() => post.postId, { onDelete: 'cascade' }),
    userId: varchar('user-id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created-at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.userId] }),
  }),
);
