CREATE TYPE "public"."challenge_mode" AS ENUM('solo', 'group');--> statement-breakpoint
CREATE TYPE "public"."challenge_state" AS ENUM('open', 'revealed', 'closed');--> statement-breakpoint
CREATE TABLE "challenge_answers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "challenge_answers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"challenge_id" integer NOT NULL,
	"unit" integer NOT NULL,
	"student_id" integer NOT NULL,
	"choice" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_answers_challenge_id_unit_unique" UNIQUE("challenge_id","unit")
);
--> statement-breakpoint
CREATE TABLE "class_challenges" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "class_challenges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"class_id" integer NOT NULL,
	"teacher_id" integer,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"mode" "challenge_mode" NOT NULL,
	"groups" jsonb NOT NULL,
	"state" "challenge_state" DEFAULT 'open' NOT NULL,
	"shown" jsonb NOT NULL,
	"clusters" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revealed_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "challenge_answers" ADD CONSTRAINT "challenge_answers_challenge_id_class_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."class_challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_answers" ADD CONSTRAINT "challenge_answers_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_challenges" ADD CONSTRAINT "class_challenges_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_challenges" ADD CONSTRAINT "class_challenges_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_challenges_class_id_idx" ON "class_challenges" USING btree ("class_id");