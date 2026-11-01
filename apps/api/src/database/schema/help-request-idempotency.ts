import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { helpRequestStatus } from './help-requests';

/** Stores a durable public acknowledgement so a client retry can be replayed safely. */
export const helpRequestIdempotency = pgTable('help_request_idempotency', {
  idempotencyKey: uuid('idempotency_key').primaryKey(),
  requestFingerprint: text('request_fingerprint').notNull(),
  acknowledgementReference: text('acknowledgement_reference').notNull(),
  acknowledgementStatus: helpRequestStatus('acknowledgement_status')
    .default('PENDING_REVIEW')
    .notNull(),
  acknowledgementMessage: text('acknowledgement_message').notNull(),
  acknowledgedAt: timestamp('acknowledged_at', {
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
