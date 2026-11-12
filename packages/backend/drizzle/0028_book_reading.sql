CREATE TYPE "public"."material_reading" AS ENUM('reading_pages', 'outlining', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."module_origin" AS ENUM('teacher', 'ai');--> statement-breakpoint
ALTER TABLE "material_pages" ADD COLUMN "visual" text;--> statement-breakpoint
ALTER TABLE "material_pages" ADD COLUMN "pictured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "material_pages" ADD COLUMN "visual_tries" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "material_versions" ADD COLUMN "file" "bytea";--> statement-breakpoint
ALTER TABLE "material_versions" ADD COLUMN "reading" "material_reading" DEFAULT 'done' NOT NULL;--> statement-breakpoint
ALTER TABLE "material_versions" ADD COLUMN "reading_error" text;--> statement-breakpoint
ALTER TABLE "material_versions" ADD COLUMN "reading_tries" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "material_versions" ADD COLUMN "read_after" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "material_versions" ADD COLUMN "outline" jsonb;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "made_by" "module_origin" DEFAULT 'teacher' NOT NULL;