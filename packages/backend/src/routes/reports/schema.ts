import { z } from 'zod';
import {
    analysisRunStatus,
    sessionDrafting,
    subject,
    understandingStatus,
    verificationDecision,
} from '../../db/schema.ts';

const id = z.coerce.number().int().positive();

export const classStudentParams = z.object({ classId: id, studentId: id });
export const reportParams = z.object({ reportId: id });
export const summaryParams = z.object({ summaryId: id });
export const checkBody = z.object({ text: z.string().trim().min(1).max(3000) });
export const excludedBody = z.object({ excluded: z.boolean() });

const status = z.enum(understandingStatus.enumValues);
const decision = z.enum(verificationDecision.enumValues);
const shown = z.object({ status, decision: decision.nullable() });
const competency = z.object({
    id: z.number(),
    code: z.string(),
    description: z.string(),
});

const report = z
    .object({
        id: z.number(),
        draft: z.string().nullable(),
        text: z.string().nullable(),
        drafting: z.enum(sessionDrafting.enumValues).nullable(),
        draftedAt: z.date().nullable(),
        checkedAt: z.date().nullable(),
        outdated: z.boolean(),
    })
    .nullable();

export const chapterReportResponse = z.object({
    chapter: z.object({
        id: z.number(),
        title: z.string(),
        subject: z.enum(subject.enumValues),
    }),
    missions: z.array(
        z.object({
            id: z.number(),
            title: z.string(),
            submittedCount: z.number(),
            analysedCount: z.number(),
        }),
    ),
    competencies: z.array(competency),
    studentCount: z.number(),
    students: z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            finished: z.number(),
            competencies: z.array(
                shown.extend({
                    competencyId: z.number(),
                    assessmentId: z.number(),
                    assignmentId: z.number(),
                }),
            ),
        }),
    ),
    counts: z.array(
        z.object({
            competencyId: z.number(),
            visible: z.number(),
            developing: z.number(),
            needsVerification: z.number(),
            notObserved: z.number(),
            withEvidence: z.number(),
        }),
    ),
    summaryCount: z.number(),
    report,
});

export const studentReportResponse = z.object({
    student: z.object({ id: z.number(), name: z.string() }),
    missions: z.array(
        z.object({
            assignmentId: z.number(),
            title: z.string(),
            chapter: z.string(),
            submittedAt: z.date().nullable(),
            analysis: z.enum(analysisRunStatus.enumValues).nullable(),
            summary: z
                .object({
                    id: z.number(),
                    text: z.string(),
                    excluded: z.boolean(),
                })
                .nullable(),
            memoryDeleted: z.boolean(),
            competencies: z.array(
                competency.extend({
                    assessmentId: z.number(),
                    estimate: status,
                    shown,
                    verifications: z.array(
                        z.object({
                            id: z.number(),
                            decision,
                            status,
                            note: z.string().nullable(),
                            createdAt: z.date(),
                        }),
                    ),
                }),
            ),
        }),
    ),
    summaryCount: z.number(),
    report,
    reviews: z.array(
        z.object({
            blockId: z.number(),
            mission: z.string(),
            prompt: z.string(),
            rounds: z.array(
                z.object({
                    tries: z.number(),
                    result: z.enum(['correct', 'revealed', 'open']),
                    at: z.date(),
                }),
            ),
        }),
    ),
});

export const draftingResponse = z.object({ drafting: z.literal('generating') });

export const checkedResponse = z.object({
    id: z.number(),
    text: z.string(),
    checkedAt: z.date(),
});

export const excludedResponse = z.object({
    id: z.number(),
    excluded: z.boolean(),
});

export type ClassStudentParams = z.infer<typeof classStudentParams>;
export type ReportParams = z.infer<typeof reportParams>;
export type SummaryParams = z.infer<typeof summaryParams>;
export type CheckBody = z.infer<typeof checkBody>;
export type ExcludedBody = z.infer<typeof excludedBody>;
