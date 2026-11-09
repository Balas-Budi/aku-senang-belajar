CREATE TABLE "reports" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reports_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"class_id" integer NOT NULL,
	"module_id" integer,
	"student_id" integer,
	"draft" text,
	"text" text,
	"drafting" "session_drafting",
	"draft_error" text,
	"model" text,
	"prompt_version" text,
	"summary_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"drafted_at" timestamp with time zone,
	"checked_by" integer,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_class_id_module_id_student_id_unique" UNIQUE NULLS NOT DISTINCT("class_id","module_id","student_id"),
	CONSTRAINT "reports_scope_check" CHECK (("reports"."module_id" is null) <> ("reports"."student_id" is null))
);
--> statement-breakpoint
ALTER TABLE "learner_summaries" ADD COLUMN "excluded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "learner_summaries" ADD COLUMN "excluded_by" integer;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_summaries" ADD CONSTRAINT "learner_summaries_excluded_by_users_id_fk" FOREIGN KEY ("excluded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;