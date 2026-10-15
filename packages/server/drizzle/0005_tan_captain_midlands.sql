CREATE TABLE "analysis_images" (
	"id" text PRIMARY KEY NOT NULL,
	"athlete_id" text NOT NULL,
	"assessment_id" text NOT NULL,
	"phase" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"measure" text DEFAULT '' NOT NULL,
	"discussion" text DEFAULT '' NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_images" ADD CONSTRAINT "analysis_images_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_images" ADD CONSTRAINT "analysis_images_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;