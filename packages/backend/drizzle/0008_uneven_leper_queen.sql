CREATE TYPE "public"."session_drafting" AS ENUM('generating', 'failed');--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD COLUMN "drafting" "session_drafting";--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD COLUMN "draft_error" text;--> statement-breakpoint
ALTER TABLE "session_blocks" ADD COLUMN "source_pages" integer[] DEFAULT '{}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_sessions_created_by_idx" ON "learning_sessions" USING btree ("created_by");