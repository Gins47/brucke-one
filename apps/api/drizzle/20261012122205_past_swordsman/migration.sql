CREATE TYPE "emergency_operation_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH');--> statement-breakpoint
CREATE TYPE "emergency_operation_status" AS ENUM('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "emergency_operation_type" AS ENUM('FLOOD', 'FIRE', 'EARTHQUAKE', 'OTHER');--> statement-breakpoint
CREATE TYPE "shelter_activation_status" AS ENUM('ACTIVE', 'DEACTIVATED');--> statement-breakpoint
CREATE TABLE "emergency_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"operation_code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"country_code" text NOT NULL,
	"type" "emergency_operation_type" NOT NULL,
	"severity" "emergency_operation_severity" NOT NULL,
	"status" "emergency_operation_status" NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "emergency_operations_organization_operation_code_unique" UNIQUE("organization_id","operation_code"),
	CONSTRAINT "emergency_operations_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "emergency_operations_ended_at_after_started_at_check" CHECK ("ended_at" IS NULL OR "started_at" IS NULL OR "ended_at" >= "started_at")
);
--> statement-breakpoint
CREATE TABLE "operation_affected_regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"emergency_operation_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"region_code" text NOT NULL,
	"region_name" text NOT NULL,
	"added_at" timestamp with time zone NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operation_affected_regions_removed_at_after_added_at_check" CHECK ("removed_at" IS NULL OR "removed_at" >= "added_at")
);
--> statement-breakpoint
CREATE TABLE "shelter_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"shelter_id" uuid NOT NULL,
	"emergency_operation_id" uuid NOT NULL,
	"status" "shelter_activation_status" NOT NULL,
	"activated_at" timestamp with time zone NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shelter_activations_deactivated_at_after_activated_at_check" CHECK ("deactivated_at" IS NULL OR "deactivated_at" >= "activated_at"),
	CONSTRAINT "shelter_activations_status_deactivation_timestamp_check" CHECK (("status" = 'ACTIVE' AND "deactivated_at" IS NULL) OR ("status" = 'DEACTIVATED' AND "deactivated_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "shelters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"shelter_code" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"country_code" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"capacity" integer NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shelters_organization_shelter_code_unique" UNIQUE("organization_id","shelter_code"),
	CONSTRAINT "shelters_id_organization_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "shelters_capacity_non_negative_check" CHECK ("capacity" >= 0),
	CONSTRAINT "shelters_latitude_range_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
	CONSTRAINT "shelters_longitude_range_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
	CONSTRAINT "shelters_coordinates_present_together_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "operation_affected_regions_current_region_unique" ON "operation_affected_regions" ("emergency_operation_id","country_code","region_code") WHERE "removed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "shelter_activations_one_active_shelter_unique" ON "shelter_activations" ("shelter_id") WHERE "status" = 'ACTIVE';--> statement-breakpoint
ALTER TABLE "emergency_operations" ADD CONSTRAINT "emergency_operations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "operation_affected_regions" ADD CONSTRAINT "operation_affected_regions_operation_id_fk" FOREIGN KEY ("emergency_operation_id") REFERENCES "emergency_operations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "shelter_activations" ADD CONSTRAINT "shelter_activations_shelter_organization_fk" FOREIGN KEY ("shelter_id","organization_id") REFERENCES "shelters"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "shelter_activations" ADD CONSTRAINT "shelter_activations_operation_organization_fk" FOREIGN KEY ("emergency_operation_id","organization_id") REFERENCES "emergency_operations"("id","organization_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "shelters" ADD CONSTRAINT "shelters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;