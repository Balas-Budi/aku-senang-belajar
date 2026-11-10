import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Queryable } from '../db/index.ts';
import {
    assignments,
    attempts,
    blockCompetencies,
    competencies,
    helpEvents,
    learningSessions,
    responseOutcome,
    responses,
    sessionBlocks,
    sessionCompetencies,
} from '../db/schema.ts';
import { diagramName } from '../learning/blocks.ts';
import { themedBlock, themesFor } from '../learning/themed-blocks.ts';
import { competencyRubric, type CompetencyRubric } from '../learning/rubric.ts';
import { answer as storedAnswer } from '../routes/student/schema.ts';

type Outcome = typeof responses.$inferSelect.outcome;

const evidenceTry = z.object({
    ref: z.int(),
    try: z.int(),
    choice: z.string(),
    reason: z.string().optional(),
    outcome: z.enum(responseOutcome.enumValues),
});

export const evidenceQuestion = z.object({
    block: z.int(),
    kind: z.enum(['check', 'challenge']),
    question: z.string(),
    picture: z.string().optional(),
    diagram: z.string().optional(),
    options: z.array(
        z.object({
            id: z.string(),
            label: z.string(),
            picture: z.string().optional(),
        }),
    ),
    rightOption: z.string(),
    tries: z.array(evidenceTry),
    help: z.object({
        hints: z.int(),
        otherExample: z.boolean(),
        answerShown: z.boolean(),
        askedTeacher: z.boolean(),
        diagrams: z.array(z.string()).optional(),
    }),
});

export const selfReport = z.object({
    ref: z.int(),
    understood: z.array(z.string()),
    confusing: z.array(z.string()),
    note: z.string().optional(),
});

export type EvidenceTry = z.infer<typeof evidenceTry>;
export type EvidenceQuestion = z.infer<typeof evidenceQuestion>;
export type SelfReport = z.infer<typeof selfReport>;

export type CompetencyEvidence = {
    id: number;
    code: string;
    description: string;
    rubric: CompetencyRubric | null;
    questions: EvidenceQuestion[];
    selfReport: SelfReport | null;
};

type Saved = {
    id: number;
    blockId: number;
    tryNumber: number;
    answer: unknown;
    outcome: Outcome;
};

function triesOf(saved: Saved[]): EvidenceTry[] {
    return saved.flatMap((row) => {
        const given = storedAnswer.parse(row.answer);

        if (given.kind !== 'check' && given.kind !== 'challenge') {
            return [];
        }

        return [
            {
                ref: row.id,
                try: row.tryNumber,
                choice: given.choice,
                ...(given.reason ? { reason: given.reason } : {}),
                outcome: row.outcome,
            },
        ];
    });
}

function selfReportOf(saved: Saved[]): SelfReport | null {
    const last = saved.at(-1);

    if (!last) {
        return null;
    }

    const given = storedAnswer.parse(last.answer);

    return given.kind === 'reflection'
        ? {
              ref: last.id,
              understood: given.understood,
              confusing: given.confusing,
              ...(given.note ? { note: given.note } : {}),
          }
        : null;
}

export function missionCompetencyIds(db: Queryable, assignmentId: number) {
    return db
        .select({ id: sessionCompetencies.competencyId })
        .from(sessionCompetencies)
        .innerJoin(
            assignments,
            eq(
                assignments.learningSessionId,
                sessionCompetencies.learningSessionId,
            ),
        )
        .where(eq(assignments.id, assignmentId));
}

export async function evidenceOf(
    db: Queryable,
    attemptId: number,
): Promise<CompetencyEvidence[]> {
    const [attempt] = await db
        .select({
            assignmentId: assignments.id,
            sessionId: learningSessions.id,
            theme: attempts.theme,
        })
        .from(attempts)
        .innerJoin(assignments, eq(assignments.id, attempts.assignmentId))
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .where(eq(attempts.id, attemptId));

    if (!attempt) {
        throw new Error(`Attempt ${attemptId} does not exist`);
    }

    const missionCompetencies = await db
        .select({
            id: competencies.id,
            code: competencies.code,
            description: competencies.description,
            rubric: competencies.rubric,
        })
        .from(competencies)
        .where(
            inArray(
                competencies.id,
                missionCompetencyIds(db, attempt.assignmentId),
            ),
        )
        .orderBy(asc(competencies.code));
    const blocks = await db
        .select({
            id: sessionBlocks.id,
            position: sessionBlocks.position,
            kind: sessionBlocks.kind,
            content: sessionBlocks.content,
        })
        .from(sessionBlocks)
        .where(eq(sessionBlocks.learningSessionId, attempt.sessionId))
        .orderBy(asc(sessionBlocks.position));
    const links =
        blocks.length > 0
            ? await db
                  .select({
                      blockId: blockCompetencies.blockId,
                      competencyId: blockCompetencies.competencyId,
                  })
                  .from(blockCompetencies)
                  .where(
                      inArray(
                          blockCompetencies.blockId,
                          blocks.map(({ id }) => id),
                      ),
                  )
            : [];
    const answers = await db
        .select({
            id: responses.id,
            blockId: responses.blockId,
            tryNumber: responses.tryNumber,
            answer: responses.answer,
            outcome: responses.outcome,
        })
        .from(responses)
        .where(eq(responses.attemptId, attemptId))
        .orderBy(asc(responses.tryNumber), asc(responses.id));
    const help = await db
        .select({ blockId: helpEvents.blockId, kind: helpEvents.kind })
        .from(helpEvents)
        .where(eq(helpEvents.attemptId, attemptId));
    const themes = await themesFor(
        db,
        blocks.map(({ id }) => ({ blockId: id, theme: attempt.theme })),
    );

    const questions = new Map<number, EvidenceQuestion>();
    const reflections = new Map<number, SelfReport>();

    for (const row of blocks) {
        const block = themedBlock(row, themes);
        const saved = answers.filter(({ blockId }) => blockId === row.id);

        if (block.kind === 'reflection') {
            const report = selfReportOf(saved);

            if (report) reflections.set(row.id, report);
            continue;
        }

        if (block.kind !== 'check' && block.kind !== 'challenge') continue;

        const tries = triesOf(saved);

        if (tries.length === 0) continue;

        const kinds = help
            .filter(({ blockId }) => blockId === row.id)
            .map(({ kind }) => kind);
        const { content } = block;
        const shown =
            block.kind === 'check'
                ? [
                      ...block.content.hints
                          .slice(
                              0,
                              Math.min(
                                  3,
                                  kinds.filter((kind) => kind === 'hint')
                                      .length,
                              ),
                          )
                          .flatMap(({ diagram }) =>
                              diagram ? [diagramName(diagram)] : [],
                          ),
                      ...(kinds.includes('example') &&
                      block.content.example.diagram
                          ? [diagramName(block.content.example.diagram)]
                          : []),
                  ]
                : [];

        questions.set(row.id, {
            block: row.position,
            kind: block.kind,
            question:
                block.kind === 'challenge'
                    ? `${block.content.prompt} ${block.content.question}`
                    : content.prompt,
            ...(content.illustration ? { picture: content.illustration } : {}),
            ...(content.diagram
                ? { diagram: diagramName(content.diagram) }
                : {}),
            options: content.options.map(({ id, label, illustration }) =>
                illustration
                    ? { id, label, picture: illustration }
                    : { id, label },
            ),
            rightOption: content.answer,
            tries,
            help: {
                hints: kinds.filter((kind) => kind === 'hint').length,
                otherExample: kinds.includes('example'),
                answerShown: kinds.includes('reveal'),
                askedTeacher: kinds.includes('ask_teacher'),
                ...(shown.length > 0 ? { diagrams: shown } : {}),
            },
        });
    }

    return missionCompetencies.map((competency) => {
        const linked = links
            .filter(({ competencyId }) => competencyId === competency.id)
            .map(({ blockId }) => blockId);

        return {
            id: competency.id,
            code: competency.code,
            description: competency.description,
            rubric:
                competency.rubric === null
                    ? null
                    : competencyRubric.parse(competency.rubric),
            questions: linked
                .flatMap((blockId) => questions.get(blockId) ?? [])
                .sort((first, second) => first.block - second.block),
            selfReport:
                linked
                    .map((blockId) => reflections.get(blockId))
                    .find(Boolean) ?? null,
        };
    });
}
