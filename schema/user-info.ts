import {
  pgTable,
  varchar,
  date,
  text,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';

import { user } from './user';

export const genderEnum = pgEnum('gender-enum', ['Male', 'Female']);
export const genderPreferenceEnum = pgEnum('gender-preference-enum', [
  'Male',
  'Female',
  'Both',
]);

export const userInfo = pgTable('user-info', {
  userId: varchar('user-id', { length: 255 })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  nickName: text('nick-name'),
  dateOfBirth: date('date-of-birth', { mode: 'date' }),
  gender: genderEnum('gender'),
  genderPreference: genderPreferenceEnum('gender-preference'),
  distancePreferredInKm: integer('distance-preferred-in-km'),
});
