CREATE TABLE IF NOT EXISTS "cal_event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"schedule_uri" text NOT NULL,
	"cal_user_uri" text NOT NULL,
	"company_id" uuid NOT NULL,
	CONSTRAINT "cal_event_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipedrive_activity_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendly_acc" RENAME TO "calendly_accs";--> statement-breakpoint
ALTER TABLE "calendly_event" RENAME TO "calendly_events";--> statement-breakpoint
ALTER TABLE "pipedrive_activity" RENAME TO "pipedrive_activities";--> statement-breakpoint
ALTER TABLE "calendly_accs" DROP CONSTRAINT "calendly_acc_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "pipedrive_activities" DROP CONSTRAINT "pipedrive_activity_calendly_event_id_calendly_event_id_fk";
--> statement-breakpoint
ALTER TABLE "calendly_accs" ALTER COLUMN "refresh_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendly_accs" ALTER COLUMN "access_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "refresh_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "access_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "calendly_org_uri" text DEFAULT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cal_event_types" ADD CONSTRAINT "cal_event_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendly_accs" ADD CONSTRAINT "calendly_accs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipedrive_activities" ADD CONSTRAINT "pipedrive_activities_calendly_event_id_calendly_events_id_fk" FOREIGN KEY ("calendly_event_id") REFERENCES "public"."calendly_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
