import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),

  code: varchar('code', { length: 30 }).notNull().unique(),

  name: varchar('name', { length: 255 }).notNull(),

  contactEmail: varchar('contact_email', {
    length: 255,
  }),

  contactPhone: varchar('contact_phone', {
    length: 15,
  }),

  officeAddress: text('office_address'),

  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp('updated_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});
