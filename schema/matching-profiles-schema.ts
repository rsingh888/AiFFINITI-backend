import {
  date,
  doublePrecision,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { user } from './user';
import { post } from './post';

export const userChatStatistics = pgTable('user_chat_statistics', {
  userId: varchar('user_id', { length: 255 })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  lastActiveTime: timestamp('last_active_time'),
  // lastChatTime: timestamp('last_chat_time'),
  // gamesPlayed: integer('games_played'),
  // totalChatMessageReceived: integer('total_chat_message_received'),
  // totalChatMessageSent: integer('total_chat_message_sent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const userProfilesScores = pgTable('user_profile_scores', {
  userId: varchar('user_id', { length: 255 })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  userProfileBaseScore: integer('user_profile_base_score'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const userPostsScores = pgTable('user_post_scores', {
  postId: uuid('post_id')
    .primaryKey()
    .references(() => post.postId, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 }).references(() => user.id, {
    onDelete: 'cascade',
  }),
  userPostBaseScore: integer('user_post_base_score'),
  /* -------------------------- --------------------------
  CAUTION: data redundancy
  since it will be updated not so frequently -- will reduce extra join 
  ----------------------------- -------------------------- */
  longitude: doublePrecision('longitude').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  distancePreferredInKm: integer('distance_preferred_in_km').notNull(),
  dateOfBirth: date('date_of_birth', { mode: 'date' }).notNull(),
  gender: varchar('gender', { length: 50 }).notNull(),
  genderPreference: varchar('gender_preference', { length: 50 }).notNull(),
  interests: varchar('interests', { length: 50 }).array(),
  /* -------------------------- -------------------------- */
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const userPostsSuggestionsStore = pgTable(
  'user_posts_suggestions_store',
  {
    userId: varchar('user_id', { length: 255 })
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    profileIds: varchar('profile_ids', { length: 255 }).array(),
    pickedProfilesCount: integer('picked_profiles_count').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
);
