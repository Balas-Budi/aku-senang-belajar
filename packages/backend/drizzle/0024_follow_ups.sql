CREATE TYPE "public"."follow_up_kind" AS ENUM('reinforce', 'enrich', 'discuss', 'reteach');--> statement-breakpoint
CREATE TABLE "follow_up_students" (
	"follow_up_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	CONSTRAINT "follow_up_students_follow_up_id_student_id_pk" PRIMARY KEY("follow_up_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "follow_ups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"class_id" integer NOT NULL,
	"teacher_id" integer,
	"assignment_id" integer NOT NULL,
	"competency_id" integer,
	"kind" "follow_up_kind" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "follow_up_students" ADD CONSTRAINT "follow_up_students_follow_up_id_follow_ups_id_fk" FOREIGN KEY ("follow_up_id") REFERENCES "public"."follow_ups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_up_students" ADD CONSTRAINT "follow_up_students_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follow_up_students_student_id_idx" ON "follow_up_students" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "follow_ups_class_id_idx" ON "follow_ups" USING btree ("class_id");