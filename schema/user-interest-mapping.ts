import {
  pgTable,
  serial,
  varchar,
  integer,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { user } from './user';

export const allInterest = [
  'Music',
  'Makeup & Beauty',
  'Movies & TV Shows',
  'Fitness & Gym',
  'Reading / Books',
  'Pets / Animals',
  'Foodie / Cooking',
  'Travel',
  'Tech & Gadgets',
  'Spirituality / Meditation',
  'Art & Creativity',
  'Photography',
  'Dancing',
  'Gaming',
  'Fashion & Style',
  'Social Causes',
  'Outdoor Activities',
  'Comedy/ Memes',
  'Adventure / Hiking',
  'Nightlife / Parties',
  'Board Games & Puzzles',
  'DIY & Crafting',
  'Karaoke',
];

export const userInterests = pgTable('interests', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
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
