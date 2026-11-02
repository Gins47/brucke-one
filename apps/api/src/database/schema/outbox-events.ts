import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { helpRequests } from './help-requests';

export type HelpRequestSubmittedOutboxPayload = {
  outboxEventId: string;
  helpRequestId: string;
};

/** Stores durable internal events that will be published by a later checkpoint. */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventType: text('event_type').notNull(),
    helpRequestId: uuid('help_request_id').notNull(),
    payload: jsonb('payload')
      .$type<HelpRequestSubmittedOutboxPayload>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    enqueuedAt: timestamp('enqueued_at', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').default(0).notNull(),
    lastError: text('last_error'),
  },
  (table) => [
    foreignKey({
      name: 'outbox_events_help_request_fk',
      columns: [table.helpRequestId],
      foreignColumns: [helpRequests.id],
    }).onDelete('restrict'),
    unique('outbox_events_help_request_event_type_unique').on(
      table.helpRequestId,
      table.eventType,
    ),
    index('outbox_events_pending_lookup_idx')
      .on(table.createdAt)
      .where(sql`${table.enqueuedAt} IS NULL`),
    check(
      'outbox_events_attempt_count_non_negative_check',
      sql`${table.attemptCount} >= 0`,
    ),
    check(
      'outbox_events_identifier_payload_check',
      sql`
        jsonb_typeof(${table.payload}) = 'object'
        AND ${table.payload} ?& ARRAY['outboxEventId', 'helpRequestId']
        AND (${table.payload} - 'outboxEventId' - 'helpRequestId') = '{}'::jsonb
        AND jsonb_typeof(${table.payload} -> 'outboxEventId') = 'string'
        AND jsonb_typeof(${table.payload} -> 'helpRequestId') = 'string'
        AND ${table.payload} ->> 'outboxEventId' = ${table.id}::text
        AND ${table.payload} ->> 'helpRequestId' = ${table.helpRequestId}::text
      `,
    ),
  ],
);
