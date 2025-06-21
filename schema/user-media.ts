import { pgTable, varchar, jsonb } from 'drizzle-orm/pg-core';
import { user } from './user';

export const userMedia = pgTable('user-media', {
  userId: varchar('user-id', { length: 255 })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  photos: jsonb('photos').$type<string[]>(),
  aiVideos: jsonb('ai-videos').$type<string[]>(),
  photoSlideShow: jsonb('photo-slide-show').$type<string[]>(),
  preferredMedia: jsonb('preferred-media').$type<string[]>(),
  aiVideoProgress: varchar('ai-video-progress', {
    length: 255,
  }),
});
