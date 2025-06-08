import { pgTable, varchar, date, text, integer } from 'drizzle-orm/pg-core';

import { user } from './user';

// export const genderEnum = pgEnum('gender-enum', ['Male', 'Female']);
// export const genderPreferenceEnum = pgEnum('gender-preference-enum', [
//   'Male',
//   'Female',
//   'Both',
// ]);

export const userInfo = pgTable('user-info', {
  userId: varchar('user-id', { length: 255 })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  nickName: varchar('nick-name', { length: 255 }),
  dateOfBirth: date('date-of-birth', { mode: 'date' }),
  gender: varchar('gender', { length: 50 }),
  genderPreference: varchar('gender-preference', { length: 50 }),
  distancePreferredInKm: integer('distance-preferred-in-km'),
});
