import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { shelterActivations } from './shelter-activations';

export const shelterActivationAvailability = pgTable(
  'shelter_activation_availability',
  {
    shelterActivationId: uuid('shelter_activation_id').primaryKey(),
    operationalCapacity: integer('operational_capacity').notNull(),
    currentOccupancy: integer('current_occupancy').notNull(),
    reservedPlaces: integer('reserved_places').notNull(),
    acceptingArrivals: boolean('accepting_arrivals').notNull(),
    availabilityNote: text('availability_note'),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: 'shelter_availability_activation_fk',
      columns: [table.shelterActivationId],
      foreignColumns: [shelterActivations.id],
    }).onDelete('restrict'),
    check(
      'shelter_availability_operational_capacity_check',
      sql`${table.operationalCapacity} >= 0`,
    ),
    check(
      'shelter_availability_current_occupancy_check',
      sql`${table.currentOccupancy} >= 0`,
    ),
    check(
      'shelter_availability_reserved_places_check',
      sql`${table.reservedPlaces} >= 0`,
    ),
    check(
      'shelter_availability_total_within_capacity_check',
      sql`${table.currentOccupancy} + ${table.reservedPlaces} <= ${table.operationalCapacity}`,
    ),
  ],
);
