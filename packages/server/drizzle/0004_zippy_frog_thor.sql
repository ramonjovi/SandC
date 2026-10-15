CREATE TABLE "consent_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"items" jsonb NOT NULL,
	"status" text NOT NULL,
	"created_by_id" text,
	"created_by_name" text NOT NULL,
	"last_edited_by_id" text,
	"last_edited_by_name" text NOT NULL,
	"approved_by_id" text,
	"approved_by_name" text,
	"approved_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" text PRIMARY KEY NOT NULL,
	"athlete_id" text NOT NULL,
	"mode" text NOT NULL,
	"template_id" text,
	"template_version" integer,
	"snapshot" jsonb NOT NULL,
	"signer_name" text NOT NULL,
	"signer_role" text NOT NULL,
	"signed_on" text NOT NULL,
	"signed_via" text NOT NULL,
	"recorded_by" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;