CREATE TABLE "subjects" (
	"key" text PRIMARY KEY NOT NULL,
	"position" integer GENERATED ALWAYS AS IDENTITY (sequence name "subjects_position_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learner_adaptations" ALTER COLUMN "subject" SET DATA TYPE text USING "subject"::text;--> statement-breakpoint
ALTER TABLE "materials" ALTER COLUMN "subject" SET DATA TYPE text USING "subject"::text;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_name_unique" ON "subjects" USING btree (lower("name"));--> statement-breakpoint
INSERT INTO "subjects" ("key", "name", "color", "icon") VALUES
	('mathematics', 'Matematika', 'pink', 'mathematics'),
	('natural_and_social_science', 'IPAS', 'green', 'natural_and_social_science'),
	('indonesian_language', 'Bahasa Indonesia', 'blue', 'indonesian_language'),
	('pancasila_education', 'Pendidikan Pancasila', 'orange', 'pancasila_education');--> statement-breakpoint
ALTER TABLE "learner_adaptations" ADD CONSTRAINT "learner_adaptations_subject_subjects_key_fk" FOREIGN KEY ("subject") REFERENCES "public"."subjects"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_subject_subjects_key_fk" FOREIGN KEY ("subject") REFERENCES "public"."subjects"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."subject";