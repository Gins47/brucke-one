CREATE TABLE "help_request_shelter_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"help_request_id" uuid NOT NULL CONSTRAINT "help_request_shelter_assignments_help_request_unique" UNIQUE,
	"emergency_operation_id" uuid NOT NULL,
	"shelter_activation_id" uuid NOT NULL,
	"reserved_group_size" integer NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_request_shelter_assignments_group_size_positive_check" CHECK ("reserved_group_size" > 0)
);
--> statement-breakpoint
ALTER TABLE "shelter_activations" ADD CONSTRAINT "shelter_activations_id_operation_unique" UNIQUE("id","emergency_operation_id");--> statement-breakpoint
ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_id_operation_unique" UNIQUE("id","emergency_operation_id");--> statement-breakpoint
ALTER TABLE "help_request_shelter_assignments" ADD CONSTRAINT "help_request_shelter_assignments_request_operation_fk" FOREIGN KEY ("help_request_id","emergency_operation_id") REFERENCES "help_requests"("id","emergency_operation_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "help_request_shelter_assignments" ADD CONSTRAINT "help_request_shelter_assignments_activation_operation_fk" FOREIGN KEY ("shelter_activation_id","emergency_operation_id") REFERENCES "shelter_activations"("id","emergency_operation_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "help_request_shelter_assignments" ADD CONSTRAINT "help_request_shelter_assignments_user_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;