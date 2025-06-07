import {
  pgTable,
  serial,
  varchar,
  integer,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { user } from './user';

export const userInterests = pgTable('interests', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
});

export const userInterestMapping = pgTable(
  'interest-mapping',
  {
    userId: integer('user-id')
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
