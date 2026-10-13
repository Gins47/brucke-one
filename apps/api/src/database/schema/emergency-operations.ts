import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations';

export const emergencyOperationStatus = pgEnum('emergency_operation_status', [
  'PLANNED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);

export const emergencyOperationType = pgEnum('emergency_operation_type', [
  'FLOOD',
  'FIRE',
  'EARTHQUAKE',
  'OTHER',
]);

export const emergencyOperationSeverity = pgEnum(
  'emergency_operation_severity',
  ['LOW', 'MEDIUM', 'HIGH'],
);

export const emergencyOperations = pgTable(
  'emergency_operations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    operationCode: text('operation_code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    countryCode: text('country_code').notNull(),
    type: emergencyOperationType('type').notNull(),
    severity: emergencyOperationSeverity('severity').notNull(),
    status: emergencyOperationStatus('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: 'emergency_operations_organization_id_organizations_id_fk',
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    }).onDelete('restrict'),
    unique('emergency_operations_organization_operation_code_unique').on(
      table.organizationId,
      table.operationCode,
    ),
    unique('emergency_operations_id_organization_unique').on(
      table.id,
      table.organizationId,
    ),
    check(
      'emergency_operations_ended_at_after_started_at_check',
      sql`${table.endedAt} IS NULL OR ${table.startedAt} IS NULL OR ${table.endedAt} >= ${table.startedAt}`,
    ),
  ],
);
