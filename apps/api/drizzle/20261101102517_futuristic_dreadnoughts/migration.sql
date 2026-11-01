CREATE TABLE "help_request_idempotency" (
	"idempotency_key" uuid PRIMARY KEY,
	"request_fingerprint" text NOT NULL,
	"acknowledgement_reference" text NOT NULL,
	"acknowledgement_status" "help_request_status" DEFAULT 'PENDING_REVIEW'::"help_request_status" NOT NULL,
	"acknowledgement_message" text NOT NULL,
	"acknowledged_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
