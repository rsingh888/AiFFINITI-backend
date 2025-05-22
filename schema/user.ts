import { pgTable, serial, varchar, boolean } from 'drizzle-orm/pg-core';

export const user = pgTable('users', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 255 }),
  email: varchar('email', { length: 255 }),
  isEmailVerified: boolean('is-email-verified').default(false),
  authProvider: varchar('auth-provider', { length: 255 }).notNull(),
});
