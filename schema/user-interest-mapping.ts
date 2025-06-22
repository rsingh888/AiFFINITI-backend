import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
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

export const userInterestMapping = pgTable('interest-mapping', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user-id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  interest: varchar('interest', { length: 50 }).notNull(),
});
