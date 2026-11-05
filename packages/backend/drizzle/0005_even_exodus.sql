CREATE TYPE "public"."analysis_run_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."uncertainty_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."understanding_status" AS ENUM('not_observed', 'developing', 'visible', 'needs_verification');--> statement-breakpoint
CREATE TYPE "public"."verification_decision" AS ENUM('agree', 'change', 'unsure');--> statement-breakpoint
CREATE TABLE "analysis_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analysis_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"attempt_id" integer NOT NULL,
	"status" "analysis_run_status" DEFAULT 'queued' NOT NULL,
	"tries" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"model" text,
	"prompt_version" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assessments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"competency_id" integer NOT NULL,
	"status" "understanding_status" NOT NULL,
	"reason" text NOT NULL,
	"uncertainty" "uncertainty_level" NOT NULL,
	"flags" jsonb NOT NULL,
	"evidence" jsonb NOT NULL,
	"follow_ups" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessments_run_id_competency_id_unique" UNIQUE("run_id","competency_id")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "verifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"assessment_id" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"decision" "verification_decision" NOT NULL,
	"status" "understanding_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_runs" ADD CONSTRAINT "analysis_runs_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_runs_attempt_id_idx" ON "analysis_runs" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "analysis_runs_status_run_after_idx" ON "analysis_runs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "assessments_competency_id_idx" ON "assessments" USING btree ("competency_id");--> statement-breakpoint
CREATE INDEX "verifications_assessment_id_idx" ON "verifications" USING btree ("assessment_id");