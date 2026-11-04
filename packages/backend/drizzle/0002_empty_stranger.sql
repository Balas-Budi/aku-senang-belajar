CREATE TYPE "public"."block_kind" AS ENUM('brain_game', 'hook', 'story', 'check', 'challenge', 'reflection');--> statement-breakpoint
CREATE TABLE "block_competencies" (
	"block_id" integer NOT NULL,
	"competency_id" integer NOT NULL,
	CONSTRAINT "block_competencies_block_id_competency_id_pk" PRIMARY KEY("block_id","competency_id")
);
--> statement-breakpoint
CREATE TABLE "competencies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "competencies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"module_id" integer NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "competencies_module_id_code_unique" UNIQUE("module_id","code")
);
--> statement-breakpoint
CREATE TABLE "session_blocks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "session_blocks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"learning_session_id" integer NOT NULL,
	"position" integer NOT NULL,
	"kind" "block_kind" NOT NULL,
	"content" jsonb NOT NULL,
	CONSTRAINT "session_blocks_learning_session_id_position_unique" UNIQUE("learning_session_id","position")
);
--> statement-breakpoint
ALTER TABLE "block_competencies" ADD CONSTRAINT "block_competencies_block_id_session_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."session_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_competencies" ADD CONSTRAINT "block_competencies_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_blocks" ADD CONSTRAINT "session_blocks_learning_session_id_learning_sessions_id_fk" FOREIGN KEY ("learning_session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "block_competencies_competency_id_idx" ON "block_competencies" USING btree ("competency_id");