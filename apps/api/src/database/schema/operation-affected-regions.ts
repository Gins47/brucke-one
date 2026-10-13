import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { emergencyOperations } from './emergency-operations';

export const operationAffectedRegions = pgTable(
  'operation_affected_regions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    emergencyOperationId: uuid('emergency_operation_id').notNull(),
    countryCode: text('country_code').notNull(),
    regionCode: text('region_code').notNull(),
    regionName: text('region_name').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: 'operation_affected_regions_operation_id_fk',
      columns: [table.emergencyOperationId],
      foreignColumns: [emergencyOperations.id],
    }).onDelete('restrict'),
    check(
      'operation_affected_regions_removed_at_after_added_at_check',
      sql`${table.removedAt} IS NULL OR ${table.removedAt} >= ${table.addedAt}`,
    ),
    uniqueIndex('operation_affected_regions_current_region_unique')
      .on(table.emergencyOperationId, table.countryCode, table.regionCode)
      .where(sql`${table.removedAt} IS NULL`),
  ],
);
