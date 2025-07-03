import { pgTable, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { user } from './user';

export const userMedia = pgTable('user-media', {
  userId: varchar('user-id', { length: 255 })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  photos: jsonb('photos').$type<string[]>(),
  aiVideos: jsonb('ai-videos').$type<string[]>(),
  photoSlideShow: jsonb('photo-slide-show').$type<string[]>(),
  // preferredMedia: jsonb('preferred-media').$type<string[]>(),
  aiVideoProgress: varchar('ai-video-progress', {
    length: 10,
  }).default('0%'),
  photoSlideShowProgress: varchar('photo-slide-show-progress', {
    length: 10,
  }).default('0%'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
