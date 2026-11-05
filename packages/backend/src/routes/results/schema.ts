import { z } from 'zod';
import { evidenceQuestion, selfReport } from '../../analysis/evidence.ts';
import { assessmentFlag } from '../../analysis/prompt.ts';
import {
    analysisRunStatus,
    subject,
    uncertaintyLevel,
    understandingStatus,
    verificationDecision,
} from '../../db/schema.ts';
import { competencyRubric } from '../../learning/rubric.ts';

const id = z.coerce.number().int().positive();

export const assignmentParams = z.object({ classId: id, assignmentId: id });
export const studentParams = assignmentParams.extend({ studentId: id });
export const assessmentParams = z.object({ assessmentId: id });
export const attemptParams = z.object({ attemptId: id });

const note = z.string().trim().max(500).optional();

export const verificationBody = z.discriminatedUnion('decision', [
    z.object({ decision: z.literal('agree'), note }),
    z.object({
        decision: z.literal('change'),
        status: z.enum(['not_observed', 'developing', 'visible']),
        note,
    }),
    z.object({ decision: z.literal('unsure'), note }),
]);

export const storedAssessment = z.object({
    flags: z.array(assessmentFlag),
    evidence: z.array(z.int()),
    followUps: z.array(z.string()),
});

const status = z.enum(understandingStatus.enumValues);
const decision = z.enum(verificationDecision.enumValues);
const progress = z.enum(['not_started', 'in_progress', 'submitted']);
const analysis = z.enum(analysisRunStatus.enumValues).nullable();
const shown = z.object({ status, decision: decision.nullable() });

const assignment = z.object({
    id: z.number(),
    title: z.string(),
    subject: z.enum(subject.enumValues),
    moduleTitle: z.string(),
});

export const assignmentsResponse = z.array(
    assignment.extend({
        assignedAt: z.date(),
        studentCount: z.number(),
        submittedCount: z.number(),
        analysedCount: z.number(),
    }),
);

export const resultsResponse = z.object({
    assignment,
    competencies: z.array(
        z.object({ id: z.number(), code: z.string(), description: z.string() }),
    ),
    students: z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            progress,
            attemptId: z.number().nullable(),
            analysis,
            competencies: z.array(
                shown.extend({
                    competencyId: z.number(),
                    assessmentId: z.number(),
                }),
            ),
        }),
    ),
});

export const verificationResponse = z.object({
    id: z.number(),
    decision,
    status,
    note: z.string().nullable(),
    createdAt: z.date(),
});

export const evidenceResponse = z.object({
    student: z.object({ id: z.number(), name: z.string() }),
    assignment,
    progress,
    attemptId: z.number().nullable(),
    analysis,
    competencies: z.array(
        z.object({
            id: z.number(),
            code: z.string(),
            description: z.string(),
            rubric: competencyRubric.nullable(),
            questions: z.array(evidenceQuestion),
            selfReport: selfReport.nullable(),
            assessment: storedAssessment
                .extend({
                    id: z.number(),
                    status,
                    reason: z.string(),
                    uncertainty: z.enum(uncertaintyLevel.enumValues),
                    shown,
                    verifications: z.array(verificationResponse),
                })
                .nullable(),
        }),
    ),
});

export type AssignmentParams = z.infer<typeof assignmentParams>;
export type StudentParams = z.infer<typeof studentParams>;
export type AssessmentParams = z.infer<typeof assessmentParams>;
export type AttemptParams = z.infer<typeof attemptParams>;
export type VerificationBody = z.infer<typeof verificationBody>;
