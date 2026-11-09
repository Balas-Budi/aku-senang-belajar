CREATE TYPE "public"."text_size" AS ENUM('normal', 'large', 'larger');--> statement-breakpoint
ALTER TYPE "public"."help_kind" ADD VALUE 'listen';--> statement-breakpoint
CREATE TABLE "student_settings" (
	"student_id" integer PRIMARY KEY NOT NULL,
	"text_size" text_size DEFAULT 'normal' NOT NULL,
	"read_aloud" boolean DEFAULT false NOT NULL,
	"speech_rate" real DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "read_aloud" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "student_settings" ADD CONSTRAINT "student_settings_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;