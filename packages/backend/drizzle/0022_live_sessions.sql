CREATE TYPE "public"."live_mode" AS ENUM('together', 'own_pace');--> statement-breakpoint
CREATE TYPE "public"."live_state" AS ENUM('open', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."live_step" AS ENUM('opening', 'story', 'challenge', 'reflection');--> statement-breakpoint
CREATE TABLE "live_sessions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "live_sessions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"assignment_id" integer NOT NULL,
	"mode" "live_mode" NOT NULL,
	"state" "live_state" DEFAULT 'open' NOT NULL,
	"open_step" "live_step" NOT NULL,
	"ends_at" timestamp with time zone,
	"started_by" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	CONSTRAINT "live_sessions_assignmentId_unique" UNIQUE("assignment_id")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "help_events" ADD COLUMN "handled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;