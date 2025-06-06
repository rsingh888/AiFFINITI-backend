import {
  pgTable,
  serial,
  text,
  integer,
  primaryKey,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from './user';

export const userInterests = pgTable('interests', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
});

export const userInterestMapping = pgTable(
  'interest-mapping',
  {
    userId: varchar('user-id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    interestId: integer('interest-id')
      .notNull()
      .references(() => userInterests.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.interestId] }),
  }),
);
