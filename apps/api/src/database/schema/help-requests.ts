import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { emergencyOperations } from './emergency-operations';

export const helpRequestStatus = pgEnum('help_request_status', [
  'PENDING_REVIEW',
  'MATCHING',
  'OPERATOR_REVIEW_REQUIRED',
  'RESERVED',
  'PARTIALLY_ARRIVED',
  'ARRIVED',
  'CANCELLED',
  'EXPIRED',
]);

export const helpRequests = pgTable(
  'help_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    emergencyOperationId: uuid('emergency_operation_id').notNull(),
    publicReference: text('public_reference').notNull(),
    shortReference: varchar('short_reference', { length: 5 }),
    requesterName: text('requester_name').notNull(),
    requesterPhone: text('requester_phone').notNull(),
    requesterEmail: text('requester_email'),
    groupSize: integer('group_size').notNull(),
    locationDescription: text('location_description').notNull(),
    canTravelIndependently: boolean('can_travel_independently').notNull(),
    medicalSupportNeeded: boolean('medical_support_needed').notNull(),
    status: helpRequestStatus('status').default('PENDING_REVIEW').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: 'help_requests_operation_fk',
      columns: [table.emergencyOperationId],
      foreignColumns: [emergencyOperations.id],
    }).onDelete('restrict'),
    unique('help_requests_public_reference_unique').on(table.publicReference),
    unique('help_requests_id_operation_unique').on(
      table.id,
      table.emergencyOperationId,
    ),
    unique('help_requests_short_reference_unique').on(table.shortReference),
    uniqueIndex('help_requests_operation_email_unique')
      .on(table.emergencyOperationId, table.requesterEmail)
      .where(sql`${table.requesterEmail} IS NOT NULL`),
    index('help_requests_operation_created_at_idx').on(
      table.emergencyOperationId,
      table.createdAt,
    ),
    check(
      'help_requests_group_size_positive_check',
      sql`${table.groupSize} > 0`,
    ),
    check(
      'help_requests_requester_email_normalized_check',
      sql`${table.requesterEmail} IS NULL OR ${table.requesterEmail} = lower(btrim(${table.requesterEmail}))`,
    ),
    check(
      'help_requests_short_reference_format_check',
      sql`${table.shortReference} IS NULL OR ${table.shortReference} ~ '^[A-Z0-9]{5}$'`,
    ),
  ],
);
