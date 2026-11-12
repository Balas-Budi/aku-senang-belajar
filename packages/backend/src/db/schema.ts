import { sql } from 'drizzle-orm';
import {
    boolean,
    check,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
    real,
    text,
    timestamp,
    unique,
    vector,
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
    'extra_challenge',
]);
export const adaptationHelp = pgEnum('adaptation_help', ['hint', 'example']);
export const adaptationLead = pgEnum('adaptation_lead', [
    'text',
    'audio',
    'visual',
]);
export const adaptationSource = pgEnum('adaptation_source', ['ai', 'teacher']);
export const liveMode = pgEnum('live_mode', ['together', 'own_pace']);
export const liveState = pgEnum('live_state', ['open', 'paused', 'ended']);
export const challengeMode = pgEnum('challenge_mode', ['solo', 'group']);
export const challengeState = pgEnum('challenge_state', [
    'open',
    'revealed',
    'closed',
]);
export const materialLicence = pgEnum('material_licence', [
    'own',
    'school',
    'open',
    'permission',
]);
export const membershipAction = pgEnum('membership_action', [
    'joined',
    'left',
    'moved',
    'deactivated',
    'reactivated',
    'archived',
]);
export const membershipEnd = pgEnum('membership_end', [
    'left',
    'moved',
    'archived',
]);
export const sessionLength = pgEnum('session_length', [
    'short',
    'medium',
    'long',
]);
export const followUpKind = pgEnum('follow_up_kind', [
    'reinforce',
    'enrich',
    'discuss',
    'reteach',
]);
export const liveStep = pgEnum('live_step', [
    'opening',
    'story',
    'challenge',
    'reflection',
]);
export type Adaptation = {
    helpFirst: (typeof adaptationHelp.enumValues)[number] | null;
    lead: (typeof adaptationLead.enumValues)[number] | null;
};
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
    'listen',
]);
export const textSize = pgEnum('text_size', ['normal', 'large', 'larger']);
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
        inactiveAt: timestamp({ withTimezone: true }),
    },
    (table) => [index('class_members_class_id_idx').on(table.classId)],
);

export const membershipEvents = pgTable(
    'membership_events',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        studentId: integer()
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        classId: integer()
            .notNull()
            .references(() => classes.id, { onDelete: 'cascade' }),
        otherClassId: integer().references(() => classes.id, {
            onDelete: 'set null',
        }),
        actorId: integer().references(() => users.id, {
            onDelete: 'set null',
        }),
        action: membershipAction().notNull(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index('membership_events_class_id_idx').on(table.classId),
        index('membership_events_other_class_id_idx').on(table.otherClassId),
    ],
);

export const pastMemberships = pgTable(
    'past_memberships',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        studentId: integer()
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        classId: integer()
            .notNull()
            .references(() => classes.id, { onDelete: 'cascade' }),
        joinedAt: timestamp({ withTimezone: true }).notNull(),
        endedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        reason: membershipEnd().notNull(),
    },
    (table) => [index('past_memberships_class_id_idx').on(table.classId)],
);

export const INTERESTS = [
    'animals',
    'football',
    'superheroes',
    'space',
    'music',
    'drawing',
    'cooking',
    'nature',
] as const;

export type Interest = (typeof INTERESTS)[number];

export const studentProfiles = pgTable('student_profiles', {
    studentId: integer()
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    interests: text().array().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const studentSettings = pgTable('student_settings', {
    studentId: integer()
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    textSize: textSize().notNull().default('normal'),
    readAloud: boolean().notNull().default(false),
    speechRate: real().notNull().default(1),
    readAloudChosen: boolean().notNull().default(false),
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
        version: integer().notNull().default(1),
        archivedAt: timestamp({ withTimezone: true }),
        source: text(),
        licence: materialLicence(),
        licenceNote: text(),
    },
    (table) => [index('materials_owner_id_idx').on(table.ownerId)],
);

export const materialPages = pgTable(
    'material_pages',
    {
        materialId: integer()
            .notNull()
            .references(() => materials.id, { onDelete: 'cascade' }),
        version: integer().notNull().default(1),
        number: integer().notNull(),
        text: text(),
    },
    (table) => [
        primaryKey({
            name: 'material_pages_material_id_version_number_pk',
            columns: [table.materialId, table.version, table.number],
        }),
    ],
);

export const materialVersions = pgTable(
    'material_versions',
    {
        materialId: integer()
            .notNull()
            .references(() => materials.id, { onDelete: 'cascade' }),
        version: integer().notNull(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [primaryKey({ columns: [table.materialId, table.version] })],
);

export const EMBEDDING_DIMENSIONS = 1536;

export const materialChunks = pgTable(
    'material_chunks',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        materialId: integer()
            .notNull()
            .references(() => materials.id, { onDelete: 'cascade' }),
        version: integer().notNull().default(1),
        pageNumber: integer().notNull(),
        position: integer().notNull(),
        text: text().notNull(),
        embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
        tries: integer().notNull().default(0),
        embedAfter: timestamp({ withTimezone: true }).notNull().defaultNow(),
        embeddedAt: timestamp({ withTimezone: true }),
    },
    (table) => [
        unique(
            'material_chunks_material_id_version_page_number_position_unique',
        ).on(table.materialId, table.version, table.pageNumber, table.position),
        index('material_chunks_embedding_idx').using(
            'hnsw',
            table.embedding.op('vector_cosine_ops'),
        ),
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
        materialVersion: integer().notNull().default(1),
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
        length: sessionLength(),
        readAloud: boolean().notNull().default(false),
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

export const sessionThemes = pgTable(
    'session_themes',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        learningSessionId: integer()
            .notNull()
            .references(() => learningSessions.id, { onDelete: 'cascade' }),
        theme: text().notNull(),
        drafting: sessionDrafting(),
        draftError: text(),
        model: text(),
        promptVersion: text(),
        readBy: integer().references(() => users.id, {
            onDelete: 'set null',
        }),
        readAt: timestamp({ withTimezone: true }),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique('session_themes_learning_session_id_theme_unique').on(
            table.learningSessionId,
            table.theme,
        ),
    ],
);

export const sessionBlockThemes = pgTable(
    'session_block_themes',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        blockId: integer()
            .notNull()
            .references(() => sessionBlocks.id, { onDelete: 'cascade' }),
        theme: text().notNull(),
        content: jsonb().notNull(),
    },
    (table) => [
        unique('session_block_themes_block_id_theme_unique').on(
            table.blockId,
            table.theme,
        ),
    ],
);

export const sessionCompetencies = pgTable(
    'session_competencies',
    {
        learningSessionId: integer()
            .notNull()
            .references(() => learningSessions.id, { onDelete: 'cascade' }),
        competencyId: integer()
            .notNull()
            .references(() => competencies.id, { onDelete: 'cascade' }),
    },
    (table) => [
        primaryKey({
            name: 'session_competencies_learning_session_id_competency_id_pk',
            columns: [table.learningSessionId, table.competencyId],
        }),
        index('session_competencies_competency_id_idx').on(table.competencyId),
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
        memoryDeletedAt: timestamp({ withTimezone: true }),
        readAloud: boolean().notNull().default(false),
        theme: text(),
        adaptation: jsonb().$type<Adaptation>(),
        lastSeenAt: timestamp({ withTimezone: true }),
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
        given: boolean().notNull().default(false),
        handledAt: timestamp({ withTimezone: true }),
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

export const learnerSummaries = pgTable('learner_summaries', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    runId: integer()
        .notNull()
        .unique('learner_summaries_run_id_unique')
        .references(() => analysisRuns.id, { onDelete: 'cascade' }),
    text: text(),
    model: text(),
    promptVersion: text(),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
    tries: integer().notNull().default(0),
    runAfter: timestamp({ withTimezone: true }).notNull().defaultNow(),
    writtenAt: timestamp({ withTimezone: true }),
    embeddedAt: timestamp({ withTimezone: true }),
    excludedAt: timestamp({ withTimezone: true }),
    excludedBy: integer().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const liveSessions = pgTable('live_sessions', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    assignmentId: integer()
        .notNull()
        .unique()
        .references(() => assignments.id, { onDelete: 'cascade' }),
    mode: liveMode().notNull(),
    state: liveState().notNull().default('open'),
    openStep: liveStep().notNull(),
    endsAt: timestamp({ withTimezone: true }),
    startedBy: integer().references(() => users.id, { onDelete: 'set null' }),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    pausedAt: timestamp({ withTimezone: true }),
    endedAt: timestamp({ withTimezone: true }),
});

export type ChallengeOption = { id: string; label: string };
export type ChallengeGroup = { id: number; studentIds: number[] };
export type ChallengeCluster = {
    label: string;
    note: string;
    answerIds: number[];
};

export const classChallenges = pgTable(
    'class_challenges',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        classId: integer()
            .notNull()
            .references(() => classes.id, { onDelete: 'cascade' }),
        teacherId: integer().references(() => users.id, {
            onDelete: 'set null',
        }),
        prompt: text().notNull(),
        options: jsonb().$type<ChallengeOption[]>().notNull(),
        mode: challengeMode().notNull(),
        groups: jsonb().$type<ChallengeGroup[]>().notNull(),
        state: challengeState().notNull().default('open'),
        shown: jsonb().$type<number[]>().notNull(),
        clusters: jsonb().$type<ChallengeCluster[]>(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        revealedAt: timestamp({ withTimezone: true }),
        closedAt: timestamp({ withTimezone: true }),
    },
    (table) => [index('class_challenges_class_id_idx').on(table.classId)],
);

export const challengeAnswers = pgTable(
    'challenge_answers',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        challengeId: integer()
            .notNull()
            .references(() => classChallenges.id, { onDelete: 'cascade' }),
        unit: integer().notNull(),
        studentId: integer()
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        choice: text().notNull(),
        reason: text().notNull(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique('challenge_answers_challenge_id_unit_unique').on(
            table.challengeId,
            table.unit,
        ),
    ],
);

export const followUps = pgTable(
    'follow_ups',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        classId: integer()
            .notNull()
            .references(() => classes.id, { onDelete: 'cascade' }),
        teacherId: integer().references(() => users.id, {
            onDelete: 'set null',
        }),
        assignmentId: integer()
            .notNull()
            .references(() => assignments.id, { onDelete: 'cascade' }),
        competencyId: integer().references(() => competencies.id, {
            onDelete: 'cascade',
        }),
        kind: followUpKind().notNull(),
        note: text(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        doneAt: timestamp({ withTimezone: true }),
    },
    (table) => [index('follow_ups_class_id_idx').on(table.classId)],
);

export const followUpStudents = pgTable(
    'follow_up_students',
    {
        followUpId: integer()
            .notNull()
            .references(() => followUps.id, { onDelete: 'cascade' }),
        studentId: integer()
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
    },
    (table) => [
        primaryKey({ columns: [table.followUpId, table.studentId] }),
        index('follow_up_students_student_id_idx').on(table.studentId),
    ],
);

export const reviewTries = pgTable(
    'review_tries',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        studentId: integer()
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        blockId: integer()
            .notNull()
            .references(() => sessionBlocks.id, { onDelete: 'cascade' }),
        tryNumber: integer().notNull(),
        answer: jsonb().notNull(),
        outcome: responseOutcome().notNull(),
        help: helpKind(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index('review_tries_student_id_block_id_idx').on(
            table.studentId,
            table.blockId,
        ),
    ],
);

export const learnerAdaptations = pgTable(
    'learner_adaptations',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        studentId: integer()
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        classId: integer()
            .notNull()
            .references(() => classes.id, { onDelete: 'cascade' }),
        subject: subject().notNull(),
        aiHelpFirst: adaptationHelp(),
        aiLead: adaptationLead(),
        aiReason: text(),
        summaryIds: jsonb().$type<number[]>().notNull().default([]),
        model: text(),
        promptVersion: text(),
        suggestedAt: timestamp({ withTimezone: true }),
        helpFirst: adaptationHelp(),
        lead: adaptationLead(),
        setBy: integer().references(() => users.id, { onDelete: 'set null' }),
        setAt: timestamp({ withTimezone: true }),
        source: adaptationSource().notNull().default('ai'),
        off: boolean().notNull().default(false),
        queued: integer().notNull().default(0),
        handled: integer().notNull().default(0),
        tries: integer().notNull().default(0),
        runAfter: timestamp({ withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique('learner_adaptations_student_id_subject_unique').on(
            table.studentId,
            table.subject,
        ),
    ],
);

export const reports = pgTable(
    'reports',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        classId: integer()
            .notNull()
            .references(() => classes.id, { onDelete: 'cascade' }),
        moduleId: integer().references(() => modules.id, {
            onDelete: 'cascade',
        }),
        studentId: integer().references(() => users.id, {
            onDelete: 'cascade',
        }),
        draft: text(),
        text: text(),
        drafting: sessionDrafting(),
        draftError: text(),
        model: text(),
        promptVersion: text(),
        summaryIds: jsonb().notNull().default([]),
        draftedAt: timestamp({ withTimezone: true }),
        checkedBy: integer().references(() => users.id),
        checkedAt: timestamp({ withTimezone: true }),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        unique('reports_class_id_module_id_student_id_unique')
            .on(table.classId, table.moduleId, table.studentId)
            .nullsNotDistinct(),
        check(
            'reports_scope_check',
            sql`(${table.moduleId} is null) <> (${table.studentId} is null)`,
        ),
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
