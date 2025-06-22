import { pgTable, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const loginFormCheckPointEnum = [
  'STARTED',
  'INTRO_DONE',
  'INTEREST_DONE',
  'LOCATION_DONE',
  'GENDER_DONE',
  'GENDER_PREFERENCE_DONE',
  'DISTANCE_PREFERRED_DONE',
  'KYC_DONE',
  'PHOTOS_DONE',
  'VIDEO_PROCESSED_DONE',
  'MEDIA_PREFERENCE_DONE',
];

export const user = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }),
  isEmailVerified: boolean('is-email-verified').default(false),
  authProvider: varchar('auth-provider', { length: 255 }).notNull(),
  loginFormCheckPoint: varchar('login-form-checkpoint', { length: 50 }).default(
    'STARTED',
  ),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
