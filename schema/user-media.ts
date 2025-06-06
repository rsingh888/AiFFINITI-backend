import { pgTable, serial, integer, jsonb } from 'drizzle-orm/pg-core';
import { user } from './user';

export const userMedia = pgTable('user-media', {
  id: serial('id').primaryKey(),
  userId: integer('user-id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  photos: jsonb('photos').$type<string[]>(),
  videos: jsonb('videos').$type<string[]>(),
});
