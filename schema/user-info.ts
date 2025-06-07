import {
  pgTable,
  varchar,
  date,
  varchar,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';

import { user } from './user';

export const genderEnum = pgEnum('gender-enum', ['Male', 'Female']);

export const userInfo = pgTable('user-info', {
  userId: varchar('user-id', { length: 255 })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  nickName: varchar('nick-name', { length: 255 }),
  dateOfBirth: date('date-of-birth', { mode: 'date' }),
  gender: genderEnum('gender'),
  distancePreferredInKm: integer('distance-preferred-in-km'),
});
