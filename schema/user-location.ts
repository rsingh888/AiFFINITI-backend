import {
  pgTable,
  varchar,
  doublePrecision,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './user';

export const userLocation = pgTable('location', {
  userId: varchar('user-id', { length: 255 })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  longitude: doublePrecision('longitude').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  street: varchar('street', { length: 255 }),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  country: varchar('country', { length: 100 }),
  zipcode: varchar('zipcode', { length: 20 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
