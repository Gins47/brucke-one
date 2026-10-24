CREATE TABLE "shelter_activation_availability" (
	"shelter_activation_id" uuid PRIMARY KEY,
	"operational_capacity" integer NOT NULL,
	"current_occupancy" integer NOT NULL,
	"reserved_places" integer NOT NULL,
	"accepting_arrivals" boolean NOT NULL,
	"availability_note" text,
	"reported_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shelter_availability_operational_capacity_check" CHECK ("operational_capacity" >= 0),
	CONSTRAINT "shelter_availability_current_occupancy_check" CHECK ("current_occupancy" >= 0),
	CONSTRAINT "shelter_availability_reserved_places_check" CHECK ("reserved_places" >= 0),
	CONSTRAINT "shelter_availability_total_within_capacity_check" CHECK ("current_occupancy" + "reserved_places" <= "operational_capacity")
);
--> statement-breakpoint
ALTER TABLE "shelter_activation_availability" ADD CONSTRAINT "shelter_availability_activation_fk" FOREIGN KEY ("shelter_activation_id") REFERENCES "shelter_activations"("id") ON DELETE RESTRICT;