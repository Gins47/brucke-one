CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_type" text NOT NULL,
	"help_request_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enqueued_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "outbox_events_help_request_event_type_unique" UNIQUE("help_request_id","event_type"),
	CONSTRAINT "outbox_events_attempt_count_non_negative_check" CHECK ("attempt_count" >= 0),
	CONSTRAINT "outbox_events_identifier_payload_check" CHECK (
        jsonb_typeof("payload") = 'object'
        AND "payload" ?& ARRAY['outboxEventId', 'helpRequestId']
        AND ("payload" - 'outboxEventId' - 'helpRequestId') = '{}'::jsonb
        AND jsonb_typeof("payload" -> 'outboxEventId') = 'string'
        AND jsonb_typeof("payload" -> 'helpRequestId') = 'string'
        AND "payload" ->> 'outboxEventId' = "id"::text
        AND "payload" ->> 'helpRequestId' = "help_request_id"::text
      )
);
--> statement-breakpoint
CREATE INDEX "outbox_events_pending_lookup_idx" ON "outbox_events" ("created_at") WHERE "enqueued_at" IS NULL;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_help_request_fk" FOREIGN KEY ("help_request_id") REFERENCES "help_requests"("id") ON DELETE RESTRICT;