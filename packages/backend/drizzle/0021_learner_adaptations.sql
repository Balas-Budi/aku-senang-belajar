CREATE TYPE "public"."adaptation_help" AS ENUM('hint', 'example');--> statement-breakpoint
CREATE TYPE "public"."adaptation_lead" AS ENUM('text', 'audio', 'visual');--> statement-breakpoint
CREATE TYPE "public"."adaptation_source" AS ENUM('ai', 'teacher');--> statement-breakpoint
ALTER TYPE "public"."block_kind" ADD VALUE 'extra_challenge';--> statement-breakpoint
CREATE TABLE "learner_adaptations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "learner_adaptations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" integer NOT NULL,
	"class_id" integer NOT NULL,
	"subject" "subject" NOT NULL,
	"ai_help_first" "adaptation_help",
	"ai_lead" "adaptation_lead",
	"ai_reason" text,
	"summary_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"prompt_version" text,
	"suggested_at" timestamp with time zone,
	"help_first" "adaptation_help",
	"lead" "adaptation_lead",
	"set_by" integer,
	"set_at" timestamp with time zone,
	"source" "adaptation_source" DEFAULT 'ai' NOT NULL,
	"off" boolean DEFAULT false NOT NULL,
	"queued" integer DEFAULT 0 NOT NULL,
	"handled" integer DEFAULT 0 NOT NULL,
	"tries" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_adaptations_student_id_subject_unique" UNIQUE("student_id","subject")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "adaptation" jsonb;--> statement-breakpoint
ALTER TABLE "help_events" ADD COLUMN "given" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "student_settings" ADD COLUMN "read_aloud_chosen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "learner_adaptations" ADD CONSTRAINT "learner_adaptations_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_adaptations" ADD CONSTRAINT "learner_adaptations_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_adaptations" ADD CONSTRAINT "learner_adaptations_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;