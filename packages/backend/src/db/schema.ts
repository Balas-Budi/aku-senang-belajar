import {
    index,
    integer,
    pgEnum,
    pgTable,
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

export const materials = pgTable('materials', {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    subject: subject().notNull(),
    title: text().notNull(),
});

export const modules = pgTable(
    'modules',
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),
        materialId: integer()
            .notNull()
            .references(() => materials.id, { onDelete: 'cascade' }),
        title: text().notNull(),
    },
    (table) => [index('modules_material_id_idx').on(table.materialId)],
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
    },
    (table) => [index('learning_sessions_module_id_idx').on(table.moduleId)],
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
