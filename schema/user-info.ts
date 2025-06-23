import {
  pgTable,
  varchar,
  date,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';

import { user } from './user';

// export const genderEnum = pgEnum('gender-enum', ['Male', 'Female']);
// export const genderPreferenceEnum = pgEnum('gender-preference-enum', [
//   'Male',
//   'Female',
//   'Both',
// ]);

export const genderType = ['Male', 'Female'];
export const genderPreferenceType = ['Male', 'Female', 'Both'];
export const GENDER_PREFERENCE_OPTIONS = {
  MALE: 'Male',
  FEMALE: 'Female',
  BOTH: 'Both',
};

export const userInfo = pgTable('user-info', {
  userId: varchar('user-id', { length: 255 })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  nickName: varchar('nick-name', { length: 255 }),
  dateOfBirth: date('date-of-birth', { mode: 'date' }),
  gender: varchar('gender', { length: 50 }),
  genderPreference: varchar('gender-preference', { length: 50 }),
  distancePreferredInKm: integer('distance-preferred-in-km'),
  sessionId: varchar('session-id', { length: 255 }),
  confidenceScore: integer('confidence-score').default(0),
  // userMediaPreference: varchar('user-media-preference', { length: 255 }),
  createdAt: timestamp('created-at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated-at', { withTimezone: true }).defaultNow(),
});
