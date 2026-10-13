import { sql } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations';

export const shelters = pgTable(
  'shelters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    shelterCode: text('shelter_code').notNull(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    countryCode: text('country_code').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    capacity: integer('capacity').notNull(),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: 'shelters_organization_id_organizations_id_fk',
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete('restrict'),
    unique('shelters_organization_shelter_code_unique').on(
      table.organizationId,
      table.shelterCode,
    ),
    unique('shelters_id_organization_unique').on(
      table.id,
      table.organizationId,
    ),
    check('shelters_capacity_non_negative_check', sql`${table.capacity} >= 0`),
    check(
      'shelters_latitude_range_check',
      sql`${table.latitude} IS NULL OR ${table.latitude} BETWEEN -90 AND 90`,
    ),
    check(
      'shelters_longitude_range_check',
      sql`${table.longitude} IS NULL OR ${table.longitude} BETWEEN -180 AND 180`,
    ),
    check(
      'shelters_coordinates_present_together_check',
      sql`(${table.latitude} IS NULL) = (${table.longitude} IS NULL)`,
    ),
  ],
);
