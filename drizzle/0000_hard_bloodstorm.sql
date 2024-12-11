CREATE TABLE IF NOT EXISTS "calendly_acc" (
	"uri" varchar PRIMARY KEY NOT NULL,
	"name" text,
	"organization" text,
	"refresh_token" text,
	"access_token" text,
	"expires_at" timestamp,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipedrive_acc" (
	"id" integer PRIMARY KEY NOT NULL,
	"company_domain" text,
	"refresh_token" text,
	"access_token" text,
	"expires_at" timestamp,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calendly_acc" ADD CONSTRAINT "calendly_acc_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipedrive_acc" ADD CONSTRAINT "pipedrive_acc_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
