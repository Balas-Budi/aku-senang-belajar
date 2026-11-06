ALTER TABLE "learning_sessions" ADD COLUMN "approved_by" integer;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD COLUMN "acknowledged_warnings" jsonb;--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;