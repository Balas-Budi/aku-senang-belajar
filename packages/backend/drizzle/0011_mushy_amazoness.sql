INSERT INTO "session_competencies" ("learning_session_id", "competency_id")
SELECT DISTINCT "session_blocks"."learning_session_id", "block_competencies"."competency_id"
FROM "block_competencies"
INNER JOIN "session_blocks" ON "session_blocks"."id" = "block_competencies"."block_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "session_competencies" ("learning_session_id", "competency_id")
SELECT "learning_sessions"."id", "competencies"."id"
FROM "learning_sessions"
INNER JOIN "competencies" ON "competencies"."module_id" = "learning_sessions"."module_id"
WHERE NOT EXISTS (
	SELECT 1 FROM "session_competencies"
	WHERE "session_competencies"."learning_session_id" = "learning_sessions"."id"
);