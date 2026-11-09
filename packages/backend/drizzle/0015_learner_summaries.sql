CREATE TABLE "learner_summaries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "learner_summaries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"text" text,
	"model" text,
	"prompt_version" text,
	"embedding" vector(1536),
	"tries" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"written_at" timestamp with time zone,
	"embedded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learner_summaries_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
ALTER TABLE "learner_summaries" ADD CONSTRAINT "learner_summaries_run_id_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."analysis_runs"("id") ON DELETE cascade ON UPDATE no action;