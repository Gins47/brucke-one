ALTER TABLE "help_requests" ADD COLUMN "short_reference" varchar(5);--> statement-breakpoint
ALTER TABLE "help_request_idempotency" ADD COLUMN "short_reference" varchar(5);--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_short_reference_unique" UNIQUE("short_reference");--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_short_reference_format_check" CHECK ("short_reference" IS NULL OR "short_reference" ~ '^[A-Z0-9]{5}$');