CREATE TABLE "session_block_themes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "session_block_themes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"block_id" integer NOT NULL,
	"theme" text NOT NULL,
	"content" jsonb NOT NULL,
	CONSTRAINT "session_block_themes_block_id_theme_unique" UNIQUE("block_id","theme")
);
--> statement-breakpoint
CREATE TABLE "session_themes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "session_themes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"learning_session_id" integer NOT NULL,
	"theme" text NOT NULL,
	"drafting" "session_drafting",
	"draft_error" text,
	"model" text,
	"prompt_version" text,
	"read_by" integer,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_themes_learning_session_id_theme_unique" UNIQUE("learning_session_id","theme")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "theme" text;--> statement-breakpoint
ALTER TABLE "session_block_themes" ADD CONSTRAINT "session_block_themes_block_id_session_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."session_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_themes" ADD CONSTRAINT "session_themes_learning_session_id_learning_sessions_id_fk" FOREIGN KEY ("learning_session_id") REFERENCES "public"."learning_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_themes" ADD CONSTRAINT "session_themes_read_by_users_id_fk" FOREIGN KEY ("read_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;