ALTER TABLE "competencies" ADD COLUMN "pages" integer[] DEFAULT '{}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "first_page" integer;--> statement-breakpoint
ALTER TABLE "modules" ADD COLUMN "last_page" integer;