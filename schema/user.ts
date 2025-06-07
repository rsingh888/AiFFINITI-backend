import { pgTable, varchar, boolean, pgEnum } from 'drizzle-orm/pg-core';

export const loginFormCheckPointEnum = pgEnum('login-form-checkpoint', [
  'STARTED',
  'INTRO_DONE',
  'INTEREST_DONE',
  'LOCATION_DONE',
  'GENDER_DONE',
  'DISTANCE_PREFERRED_DONE',
  'PHOTOS_DONE',
]);

export const user = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }),
  isEmailVerified: boolean('is-email-verified').default(false),
  authProvider: varchar('auth-provider', { length: 255 }).notNull(),
  loginFormCheckPoint: loginFormCheckPointEnum('login-form-checkpoint').default(
    'STARTED',
  ),
});
