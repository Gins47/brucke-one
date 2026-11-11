import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { helpRequests } from './help-requests';
import { shelterActivations } from './shelter-activations';
import { users } from './users';

export const helpRequestShelterAssignments = pgTable(
  'help_request_shelter_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    helpRequestId: uuid('help_request_id').notNull(),
    emergencyOperationId: uuid('emergency_operation_id').notNull(),
    shelterActivationId: uuid('shelter_activation_id').notNull(),
    reservedGroupSize: integer('reserved_group_size').notNull(),
    assignedByUserId: uuid('assigned_by_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('help_request_shelter_assignments_help_request_unique').on(
      table.helpRequestId,
    ),
    check(
      'help_request_shelter_assignments_group_size_positive_check',
      sql`${table.reservedGroupSize} > 0`,
    ),
    foreignKey({
      name: 'help_request_shelter_assignments_request_operation_fk',
      columns: [table.helpRequestId, table.emergencyOperationId],
      foreignColumns: [helpRequests.id, helpRequests.emergencyOperationId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'help_request_shelter_assignments_activation_operation_fk',
      columns: [table.shelterActivationId, table.emergencyOperationId],
      foreignColumns: [
        shelterActivations.id,
        shelterActivations.emergencyOperationId,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'help_request_shelter_assignments_user_fk',
      columns: [table.assignedByUserId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),
  ],
);
