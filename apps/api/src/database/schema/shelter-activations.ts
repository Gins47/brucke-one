import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { emergencyOperations } from './emergency-operations';
import { shelters } from './shelters';

export const shelterActivationStatus = pgEnum('shelter_activation_status', [
  'ACTIVE',
  'DEACTIVATED',
]);

export const shelterActivations = pgTable(
  'shelter_activations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    shelterId: uuid('shelter_id').notNull(),
    emergencyOperationId: uuid('emergency_operation_id').notNull(),
    status: shelterActivationStatus('status').notNull(),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull(),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: 'shelter_activations_shelter_organization_fk',
      columns: [table.shelterId, table.organizationId],
      foreignColumns: [shelters.id, shelters.organizationId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'shelter_activations_operation_organization_fk',
      columns: [table.emergencyOperationId, table.organizationId],
      foreignColumns: [
        emergencyOperations.id,
        emergencyOperations.organizationId,
      ],
    }).onDelete('restrict'),
    check(
      'shelter_activations_deactivated_at_after_activated_at_check',
      sql`${table.deactivatedAt} IS NULL OR ${table.deactivatedAt} >= ${table.activatedAt}`,
    ),
    check(
      'shelter_activations_status_deactivation_timestamp_check',
      sql`(${table.status} = 'ACTIVE' AND ${table.deactivatedAt} IS NULL) OR (${table.status} = 'DEACTIVATED' AND ${table.deactivatedAt} IS NOT NULL)`,
    ),
    uniqueIndex('shelter_activations_one_active_shelter_unique')
      .on(table.shelterId)
      .where(sql`${table.status} = 'ACTIVE'`),
  ],
);
