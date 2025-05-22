import {
  pgTable,
  varchar,
  doublePrecision,
  serial,
  integer,
  unique,
} from 'drizzle-orm/pg-core';
import { user } from './user';

export const userLocation = pgTable(
  'location',
  {
    id: serial('id').primaryKey(),
    userId: integer('user-id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    longitude: doublePrecision('longitude').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    street: varchar('street', { length: 255 }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    country: varchar('country', { length: 100 }),
    zipcode: varchar('zipcode', { length: 20 }),
  },
  (table) => {
    return {
      userLocationUnique: unique().on(table.userId),
    };
  },
);
