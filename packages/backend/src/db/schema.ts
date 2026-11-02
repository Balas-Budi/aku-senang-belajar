import {
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
} from 'drizzle-orm/pg-core';

export const role = pgEnum('role', ['teacher', 'student', 'admin']);

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
