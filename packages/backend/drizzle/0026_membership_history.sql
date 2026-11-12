CREATE TYPE "public"."membership_action" AS ENUM('joined', 'left', 'moved', 'deactivated', 'reactivated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."membership_end" AS ENUM('left', 'moved', 'archived');--> statement-breakpoint
CREATE TABLE "membership_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "membership_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" integer NOT NULL,
	"class_id" integer NOT NULL,
	"other_class_id" integer,
	"actor_id" integer,
	"action" "membership_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "past_memberships" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "past_memberships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" integer NOT NULL,
	"class_id" integer NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" "membership_end" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_members" ADD COLUMN "inactive_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "membership_events" ADD CONSTRAINT "membership_events_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_events" ADD CONSTRAINT "membership_events_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_events" ADD CONSTRAINT "membership_events_other_class_id_classes_id_fk" FOREIGN KEY ("other_class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_events" ADD CONSTRAINT "membership_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_memberships" ADD CONSTRAINT "past_memberships_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "past_memberships" ADD CONSTRAINT "past_memberships_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_events_class_id_idx" ON "membership_events" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "membership_events_other_class_id_idx" ON "membership_events" USING btree ("other_class_id");--> statement-breakpoint
CREATE INDEX "past_memberships_class_id_idx" ON "past_memberships" USING btree ("class_id");