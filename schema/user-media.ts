import { pgTable, jsonb, varchar } from 'drizzle-orm/pg-core';
import { user } from './user';

export const userMedia = pgTable('user-media', {
  userId: varchar('user-id', { length: 255 })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  photos: jsonb('photos').$type<string[]>(),
  videos: jsonb('videos').$type<string[]>(),
});
