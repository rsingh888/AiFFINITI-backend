import {
  pgTable,
  serial,
  date,
  text,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';

import { user } from './user';

export const loginFormCheckPointEnum = pgEnum('login-form-checkpoint', [
  'STARTED',
  'PHONE_DONE',
  'INTRO_DONE',
  'INTREST_DONE',
  'LOCATION_DONE',
  'GENDER_DONE',
  'DISTANCE_PREFERRED_DONE',
  'PHOTOS_DONE',
  'VIDEO_DONE',
]);

export const genderEnum = pgEnum('gender-enum', ['Male', 'Female']);

export const userInfo = pgTable('user-info', {
  playerId: serial('player-id').primaryKey(),
  userId: integer('user-id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  nickName: text('nick-name'),
  dateOfBirth: date('date-of-birth', { mode: 'date' }),
  gender: genderEnum('gender'),
  distancePreferred: integer('distance-preferred'),
  loginFormCheckPoint: loginFormCheckPointEnum('login-form-checkpoint').default(
    'STARTED',
  ),
});
