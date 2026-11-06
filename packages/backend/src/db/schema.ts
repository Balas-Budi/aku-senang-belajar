import { sql } from 'drizzle-orm';
import {
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    unique,
} from 'drizzle-orm/pg-core';

export const role = pgEnum('role', ['teacher', 'student', 'admin']);
export const subject = pgEnum('subject', [
    'mathematics',
    'natural_and_social_science',
    'indonesian_language',
    'pancasila_education',
]);
export const learningSessionStatus = pgEnum('learning_session_status', [
    'draft',
    'ready',
]);
export const sessionDrafting = pgEnum('session_drafting', [
    'generating',
    'failed',
]);
export const blockKind = pgEnum('block_kind', [
    'brain_game',
    'hook',
    'story',
    'check',
    'challenge',
    'reflection',
]);
export const attemptStatus = pgEnum('attempt_status', [
    'in_progress',
    'submitted',
]);
export const responseOutcome = pgEnum('response_outcome', [
    'accepted',
    'correct',
    'not_yet',
]);
export const helpKind = pgEnum('help_kind', [
    'hint',
    'example',
    'ask_teacher',
    'reveal',
]);
export const analysisRunStatus = pgEnum('analysis_run_status', [
    'queued',
    'running',
    'succeeded',
    'failed',
]);
export const understandingStatus = pgEnum('understanding_status', [
    'not_observed',
    'developing',
    'visible',
    'needs_verification',
]);
export const uncertaintyLevel = pgEnum('uncertainty_level', [
    'low',
    'medium',
    'high',
]);
export const verificationDecision = pgEnum('verification_decision', [
    'agree',
    'change',
    'unsure',
]);

export const users = pgTable('users', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    role: role().notNull(),
    name: text().notNull(),
    username: text().notNull().unique(),
    passwordHash: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
});

export const classes = pgTable(
    'classes',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        teacherId: integer()
            .notNull()
            .references(() => users.id),
        name: text().notNull(),
        inviteCode: text().unique(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index('classes_teacher_id_idx').on(table.teacherId)],
);

export const classMembers = pgTable(
    'class_members',
    {
        studentId: integer()
            .primaryKey()
            .references(() => users.id, { onDelete: 'cascade' }),
        classId: integer()
            .notNull()
            .references(() => classes.id, { onDelete: 'cascade' }),
        joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index('class_members_class_id_idx').on(table.classId)],
);

export const studentProfiles = pgTable('student_profiles', {
    studentId: integer()
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    interests: text().array().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const materials = pgTable(
    'materials',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        subject: subject().notNull(),
        title: text().notNull(),
        grade: integer(),
        ownerId: integer().references(() => users.id, { onDelete: 'cascade' }),
        rightsConfirmedAt: timestamp({ withTimezone: true }),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index('materials_owner_id_idx').on(table.ownerId)],
);

export const materialPages = pgTable(
    'material_pages',
    {
        materialId: integer()
            .notNull()
            .references(() => materials.id, { onDelete: 'cascade' }),
        number: integer().notNull(),
        text: text(),
    },
    (table) => [
        primaryKey({
            name: 'material_pages_material_id_number_pk',
            columns: [table.materialId, table.number],
        }),
    ],
);

export const modules = pgTable(
    'modules',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        materialId: integer()
            .notNull()
            .references(() => materials.id, { onDelete: 'cascade' }),
        title: text().notNull(),
        firstPage: integer(),
        lastPage: integer(),
    },
    (table) => [index('modules_material_id_idx').on(table.materialId)],
);

export const competencies = pgTable(
    'competencies',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        moduleId: integer()
            .notNull()
            .references(() => modules.id, { onDelete: 'cascade' }),
        code: text().notNull(),
        description: text().notNull(),
        rubric: jsonb(),
        pages: integer()
            .array()
            .notNull()
            .default(sql`'{}'::integer[]`),
    },
    (table) => [
        unique('competencies_module_id_code_unique').on(
            table.moduleId,
            table.code,
        ),
    ],
);

export const learningSessions = pgTable(
    'learning_sessions',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        moduleId: integer()
            .notNull()
            .references(() => modules.id, { onDelete: 'cascade' }),
        title: text().notNull(),
        summary: text().notNull(),
        status: learningSessionStatus().notNull().default('draft'),
        createdBy: integer().references(() => users.id, {
            onDelete: 'cascade',
        }),
        version: integer().notNull().default(1),
        drafting: sessionDrafting(),
        draftError: text(),
        approvedBy: integer().references(() => users.id, {
            onDelete: 'set null',
        }),
        approvedAt: timestamp({ withTimezone: true }),
        acknowledgedWarnings: jsonb(),
    },
    (table) => [
        index('learning_sessions_module_id_idx').on(table.moduleId),
        index('learning_sessions_created_by_idx').on(table.createdBy),
    ],
);

export const sessionBlocks = pgTable(
    'session_blocks',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        learningSessionId: integer()
            .notNull()
            .references(() => learningSessions.id, { onDelete: 'cascade' }),
        position: integer().notNull(),
        kind: blockKind().notNull(),
        content: jsonb().notNull(),
        sourcePages: integer()
            .array()
            .notNull()
            .default(sql`'{}'::integer[]`),
    },
    (table) => [
        unique('session_blocks_learning_session_id_position_unique').on(
            table.learningSessionId,
            table.position,
        ),
    ],
);

export const blockCompetencies = pgTable(
    'block_competencies',
    {
        blockId: integer()
            .notNull()
            .references(() => sessionBlocks.id, { onDelete: 'cascade' }),
        competencyId: integer()
            .notNull()
            .references(() => competencies.id, { onDelete: 'cascade' }),
    },
    (table) => [
        primaryKey({
            name: 'block_competencies_block_id_competency_id_pk',
            columns: [table.blockId, table.competencyId],
        }),
        index('block_competencies_competency_id_idx').on(table.competencyId),
    ],
);

export const assignments = pgTable(
    'assignments',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        learningSessionId: integer()
            .notNull()
            .references(() => learningSessions.id, { onDelete: 'cascade' }),
        classId: integer()
            .notNull()
            .references(() => classes.id, { onDelete: 'cascade' }),
        assignedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique('assignments_learning_session_id_class_id_unique').on(
            table.learningSessionId,
            table.classId,
        ),
        index('assignments_class_id_idx').on(table.classId),
    ],
);

export const attempts = pgTable(
    'attempts',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        assignmentId: integer()
            .notNull()
            .references(() => assignments.id, { onDelete: 'cascade' }),
        studentId: integer()
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        status: attemptStatus().notNull().default('in_progress'),
        currentBlockId: integer()
            .notNull()
            .references(() => sessionBlocks.id, { onDelete: 'cascade' }),
        startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        submittedAt: timestamp({ withTimezone: true }),
    },
    (table) => [
        unique('attempts_assignment_id_student_id_unique').on(
            table.assignmentId,
            table.studentId,
        ),
        index('attempts_student_id_idx').on(table.studentId),
        index('attempts_current_block_id_idx').on(table.currentBlockId),
    ],
);

export const responses = pgTable(
    'responses',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        attemptId: integer()
            .notNull()
            .references(() => attempts.id, { onDelete: 'cascade' }),
        blockId: integer()
            .notNull()
            .references(() => sessionBlocks.id, { onDelete: 'cascade' }),
        tryNumber: integer().notNull(),
        answer: jsonb().notNull(),
        outcome: responseOutcome().notNull(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique('responses_attempt_id_block_id_try_number_unique').on(
            table.attemptId,
            table.blockId,
            table.tryNumber,
        ),
        index('responses_block_id_idx').on(table.blockId),
    ],
);

export const helpEvents = pgTable(
    'help_events',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        attemptId: integer()
            .notNull()
            .references(() => attempts.id, { onDelete: 'cascade' }),
        blockId: integer()
            .notNull()
            .references(() => sessionBlocks.id, { onDelete: 'cascade' }),
        kind: helpKind().notNull(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index('help_events_attempt_id_idx').on(table.attemptId),
        index('help_events_block_id_idx').on(table.blockId),
    ],
);

export const analysisRuns = pgTable(
    'analysis_runs',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        attemptId: integer()
            .notNull()
            .references(() => attempts.id, { onDelete: 'cascade' }),
        status: analysisRunStatus().notNull().default('queued'),
        tries: integer().notNull().default(0),
        runAfter: timestamp({ withTimezone: true }).notNull().defaultNow(),
        model: text(),
        promptVersion: text(),
        error: text(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        startedAt: timestamp({ withTimezone: true }),
        finishedAt: timestamp({ withTimezone: true }),
    },
    (table) => [
        index('analysis_runs_attempt_id_idx').on(table.attemptId),
        index('analysis_runs_status_run_after_idx').on(
            table.status,
            table.runAfter,
        ),
    ],
);

export const assessments = pgTable(
    'assessments',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        runId: integer()
            .notNull()
            .references(() => analysisRuns.id, { onDelete: 'cascade' }),
        competencyId: integer()
            .notNull()
            .references(() => competencies.id, { onDelete: 'cascade' }),
        status: understandingStatus().notNull(),
        reason: text().notNull(),
        uncertainty: uncertaintyLevel().notNull(),
        flags: jsonb().notNull(),
        evidence: jsonb().notNull(),
        followUps: jsonb().notNull(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique('assessments_run_id_competency_id_unique').on(
            table.runId,
            table.competencyId,
        ),
        index('assessments_competency_id_idx').on(table.competencyId),
    ],
);

export const verifications = pgTable(
    'verifications',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        assessmentId: integer()
            .notNull()
            .references(() => assessments.id, { onDelete: 'cascade' }),
        teacherId: integer()
            .notNull()
            .references(() => users.id),
        decision: verificationDecision().notNull(),
        status: understandingStatus().notNull(),
        note: text(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index('verifications_assessment_id_idx').on(table.assessmentId),
    ],
);

export const sessions = pgTable(
    'sessions',
    {
        id: text().primaryKey(),
        userId: integer()
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        userAgent: text(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        expiresAt: timestamp({ withTimezone: true }).notNull(),
    },
    (table) => [index('sessions_user_id_idx').on(table.userId)],
);
