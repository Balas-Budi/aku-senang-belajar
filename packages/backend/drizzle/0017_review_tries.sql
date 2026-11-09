CREATE TABLE "review_tries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "review_tries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" integer NOT NULL,
	"block_id" integer NOT NULL,
	"try_number" integer NOT NULL,
	"answer" jsonb NOT NULL,
	"outcome" "response_outcome" NOT NULL,
	"help" "help_kind",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_tries" ADD CONSTRAINT "review_tries_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tries" ADD CONSTRAINT "review_tries_block_id_session_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."session_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_tries_student_id_block_id_idx" ON "review_tries" USING btree ("student_id","block_id");