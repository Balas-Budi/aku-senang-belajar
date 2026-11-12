CREATE TYPE "public"."session_length" AS ENUM('short', 'medium', 'long');--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD COLUMN "length" "session_length";--> statement-breakpoint
ALTER TABLE "learning_sessions" ADD COLUMN "read_aloud" boolean DEFAULT false NOT NULL;