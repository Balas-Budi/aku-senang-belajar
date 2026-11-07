CREATE TABLE "session_competencies" (
	"learning_session_id" integer NOT NULL,
	"competency_id" integer NOT NULL,
	CONSTRAINT "session_competencies_learning_session_id_competency_id_pk" PRIMARY KEY("learning_session_id","competency_id")
);
--> statement-breakpoint
ALTER TABLE "session_competencies" ADD CONSTRAINT "session_competencies_learning_session_id_learning_sessions_id_fk" FOREIGN KEY ("learning_session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_competencies" ADD CONSTRAINT "session_competencies_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_competencies_competency_id_idx" ON "session_competencies" USING btree ("competency_id");