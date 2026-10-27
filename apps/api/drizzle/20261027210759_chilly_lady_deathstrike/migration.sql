CREATE TYPE "help_request_status" AS ENUM('PENDING_REVIEW', 'MATCHING', 'OPERATOR_REVIEW_REQUIRED', 'RESERVED', 'PARTIALLY_ARRIVED', 'ARRIVED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "help_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"emergency_operation_id" uuid NOT NULL,
	"public_reference" text NOT NULL CONSTRAINT "help_requests_public_reference_unique" UNIQUE,
	"requester_name" text NOT NULL,
	"requester_phone" text NOT NULL,
	"requester_email" text,
	"group_size" integer NOT NULL,
	"location_description" text NOT NULL,
	"can_travel_independently" boolean NOT NULL,
	"medical_support_needed" boolean NOT NULL,
	"status" "help_request_status" DEFAULT 'PENDING_REVIEW'::"help_request_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_requests_group_size_positive_check" CHECK ("group_size" > 0),
	CONSTRAINT "help_requests_requester_email_normalized_check" CHECK ("requester_email" IS NULL OR "requester_email" = lower(btrim("requester_email")))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "help_requests_operation_email_unique" ON "help_requests" ("emergency_operation_id","requester_email") WHERE "requester_email" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "help_requests_operation_created_at_idx" ON "help_requests" ("emergency_operation_id","created_at");--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_operation_fk" FOREIGN KEY ("emergency_operation_id") REFERENCES "emergency_operations"("id") ON DELETE RESTRICT;