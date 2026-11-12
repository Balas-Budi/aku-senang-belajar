import { and, eq, gt, gte, isNull, ne, or, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { currentUser } from '../../auth/guards.ts';
import {
    assessments,
    classMembers,
    learnerAdaptations,
    learnerSummaries,
    reports,
    verifications,
} from '../../db/schema.ts';
import type { Queryable } from '../../db/index.ts';
import { AppError, notFound } from '../../lib/errors.ts';
import {
    MAX_ADAPTATION_TRIES,
    requeueForSummary,
} from '../../memory/adaptations.ts';
import {
    CLASS_REPORT_PROMPT,
    type ReportRequest,
    STUDENT_REPORT_PROMPT,
    startReportDraft,
} from '../../memory/reports.ts';
import { pastMembersOf } from '../classes/membership.ts';
import { membersOf, ownedClassId } from '../classes/queries.ts';
import type { ChapterParams } from '../classes/schema.ts';
import {
    adaptationsOf,
    chapterMap,
    ownedReport,
    ownedSummary,
    practiceOf,
    reportIn,
    type Scope,
    scopeOf,
    studentHistory,
} from './queries.ts';
import type {
    AdaptationBody,
    AdaptationParams,
    CheckBody,
    ClassStudentParams,
    ExcludedBody,
    ReportParams,
    SummaryParams,
} from './schema.ts';

type Status = typeof assessments.$inferSelect.status;
type Decision = typeof verifications.$inferSelect.decision;

const statusLabels: Record<Status, string> = {
    visible: 'Terlihat',
    developing: 'Berkembang',
    needs_verification: 'Perlu verifikasi',
    not_observed: 'Belum teramati',
};

const decisionLabels: Record<Decision, string> = {
    agree: 'Diverifikasi guru',
    change: 'Diubah guru',
    unsure: 'Guru belum yakin',
};

async function ownedChapter(
    request: FastifyRequest<{ Params: ChapterParams }>,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );

    return {
        classId,
        map: await chapterMap(db, classId, request.params.moduleId),
    };
}

async function ownedMember(
    db: Queryable,
    classId: number,
    teacherId: number,
    studentId: number,
) {
    const owned = await ownedClassId(db, classId, teacherId);
    const student = (await membersOf(db, owned)).find(
        ({ id }) => id === studentId,
    );

    if (!student) {
        throw notFound('Student not found');
    }

    return { classId: owned, student };
}

async function ownedStudent(
    request: FastifyRequest<{ Params: ClassStudentParams }>,
    departed = false,
) {
    const { db } = request.server;
    const { studentId } = request.params;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );
    const current = (await membersOf(db, classId)).find(
        ({ id }) => id === studentId,
    );
    const past = current
        ? undefined
        : departed
          ? (await pastMembersOf(db, classId)).find(
                (member) => member.studentId === studentId,
            )
          : undefined;
    const student =
        current ?? (past && { id: past.studentId, name: past.name });

    if (!student) {
        throw notFound('Student not found');
    }

    return {
        classId,
        member: current !== undefined,
        history: await studentHistory(db, classId, student),
    };
}

async function beginDraft(
    app: FastifyInstance,
    scope: Scope,
    draft: ReportRequest,
) {
    if (draft.summaryIds.length === 0) {
        throw new AppError(409, {
            message: 'There is no learner summary to draft a report from',
            code: 'NO_SUMMARIES',
        });
    }

    const [created] = await app.db
        .insert(reports)
        .values({ ...scope, drafting: 'generating' })
        .onConflictDoNothing()
        .returning({ id: reports.id });
    const [claimed] = created
        ? [created]
        : await app.db
              .update(reports)
              .set({ drafting: 'generating', draftError: null })
              .where(
                  and(
                      scopeOf(scope),
                      or(
                          isNull(reports.drafting),
                          ne(reports.drafting, 'generating'),
                      ),
                  ),
              )
              .returning({ id: reports.id });

    if (!claimed) {
        throw new AppError(409, {
            message: 'This report is being drafted already',
            code: 'REPORT_DRAFTING',
        });
    }

    startReportDraft(app, claimed.id, draft);
}

export async function chapterReport(
    request: FastifyRequest<{ Params: ChapterParams }>,
) {
    const { classId, map } = await ownedChapter(request);
    const { summaries, ...rest } = map;

    return {
        ...rest,
        summaryCount: summaries.length,
        report: await reportIn(
            request.server.db,
            { classId, moduleId: map.chapter.id, studentId: null },
            summaries.map(({ id }) => id),
        ),
    };
}

export async function draftChapterReport(
    request: FastifyRequest<{ Params: ChapterParams }>,
    reply: FastifyReply,
) {
    const { classId, map } = await ownedChapter(request);

    await beginDraft(
        request.server,
        { classId, moduleId: map.chapter.id, studentId: null },
        {
            system: CLASS_REPORT_PROMPT,
            user: JSON.stringify({
                chapter: map.chapter.title,
                students: map.studentCount,
                competencies: map.competencies.map((competency) => {
                    const counted = map.counts.find(
                        ({ competencyId }) => competencyId === competency.id,
                    );

                    return {
                        code: competency.code,
                        description: competency.description,
                        visible: counted?.visible ?? 0,
                        developing: counted?.developing ?? 0,
                        needs_verification: counted?.needsVerification ?? 0,
                        not_observed: counted?.notObserved ?? 0,
                    };
                }),
                notes: map.summaries.map(({ text }) => text),
            }),
            summaryIds: map.summaries.map(({ id }) => id),
        },
    );

    return reply.code(202).send({ drafting: 'generating' });
}

function csvLine(values: (string | number)[]) {
    return values
        .map((value) => {
            const text = String(value).replace(/^[=+\-@]/, "'$&");

            return /[",\r\n]/.test(text)
                ? `"${text.replaceAll('"', '""')}"`
                : text;
        })
        .join(',');
}

export async function chapterCsv(
    request: FastifyRequest<{ Params: ChapterParams }>,
    reply: FastifyReply,
) {
    const { map } = await ownedChapter(request);
    const lines = [
        csvLine([
            'Siswa',
            'Misi selesai',
            ...map.competencies.map(({ code }) => code),
        ]),
        ...map.students.map((student) =>
            csvLine([
                student.name,
                `${student.finished} dari ${map.missions.length}`,
                ...map.competencies.map((competency) => {
                    const cell = student.competencies.find(
                        ({ competencyId }) => competencyId === competency.id,
                    );

                    return cell
                        ? `${statusLabels[cell.status]} (${cell.decision ? decisionLabels[cell.decision] : 'Saran AI'})`
                        : '';
                }),
            ]),
        ),
    ];

    return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header(
            'content-disposition',
            `attachment; filename="laporan-bab-${map.chapter.id}.csv"`,
        )
        .send(`﻿${lines.join('\r\n')}\r\n`);
}

export async function studentReport(
    request: FastifyRequest<{ Params: ClassStudentParams }>,
) {
    const { classId, member, history } = await ownedStudent(request, true);
    const { summaries, ...rest } = history;

    return {
        ...rest,
        member,
        summaryCount: summaries.length,
        report: await reportIn(
            request.server.db,
            { classId, moduleId: null, studentId: history.student.id },
            summaries.map(({ id }) => id),
        ),
        reviews: await practiceOf(
            request.server.db,
            classId,
            history.student.id,
        ),
        adaptations: await adaptationsOf(
            request.server.db,
            classId,
            history.student.id,
        ),
    };
}

export async function setAdaptation(
    request: FastifyRequest<{
        Params: AdaptationParams;
        Body: AdaptationBody;
    }>,
) {
    const { db } = request.server;
    const teacher = currentUser(request);
    const { classId, student } = await ownedMember(
        db,
        request.params.classId,
        teacher.id,
        request.params.studentId,
    );
    const { subject } = request.params;
    const { body } = request;
    const choice =
        'helpFirst' in body
            ? {
                  helpFirst: body.helpFirst,
                  lead: body.lead,
                  source: 'teacher' as const,
                  off: false,
              }
            : 'off' in body
              ? { off: body.off }
              : {
                    source: 'ai' as const,
                    helpFirst: null,
                    lead: null,
                    off: false,
                };
    const queues = !('helpFirst' in body) && choice.off === false;
    const now = new Date();
    const stamp = { setBy: teacher.id, setAt: now, updatedAt: now };
    const requeue = or(
        eq(learnerAdaptations.off, true),
        'source' in choice && choice.source === 'ai'
            ? eq(learnerAdaptations.source, 'teacher')
            : undefined,
        and(
            gt(learnerAdaptations.queued, learnerAdaptations.handled),
            gte(learnerAdaptations.tries, MAX_ADAPTATION_TRIES),
        ),
    );

    await db.transaction(async (tx) => {
        const [member] = await tx
            .select({ classId: classMembers.classId })
            .from(classMembers)
            .where(eq(classMembers.studentId, student.id))
            .for('share');

        if (member?.classId !== classId) {
            throw notFound('Student not found');
        }

        await tx
            .delete(learnerAdaptations)
            .where(
                and(
                    eq(learnerAdaptations.studentId, student.id),
                    eq(learnerAdaptations.subject, subject),
                    ne(learnerAdaptations.classId, classId),
                ),
            );
        await tx
            .insert(learnerAdaptations)
            .values({
                studentId: student.id,
                classId,
                subject,
                ...choice,
                ...stamp,
                queued: queues ? 1 : 0,
            })
            .onConflictDoUpdate({
                target: [
                    learnerAdaptations.studentId,
                    learnerAdaptations.subject,
                ],
                set: {
                    ...choice,
                    ...stamp,
                    ...(queues
                        ? {
                              queued: sql`case when ${requeue} then ${learnerAdaptations.queued} + 1 else ${learnerAdaptations.queued} end`,
                              tries: sql`case when ${requeue} then 0 else ${learnerAdaptations.tries} end`,
                              runAfter: sql`case when ${requeue} then now() else ${learnerAdaptations.runAfter} end`,
                          }
                        : {}),
                },
            });
    });

    const [item] = await adaptationsOf(db, classId, student.id, subject);

    return item;
}

export async function draftStudentReport(
    request: FastifyRequest<{ Params: ClassStudentParams }>,
    reply: FastifyReply,
) {
    const { classId, history } = await ownedStudent(request);
    const usable = new Set(history.summaries.map(({ id }) => id));

    await beginDraft(
        request.server,
        { classId, moduleId: null, studentId: history.student.id },
        {
            system: STUDENT_REPORT_PROMPT,
            user: JSON.stringify({
                missions: history.missions.flatMap((mission) =>
                    mission.summary && usable.has(mission.summary.id)
                        ? [
                              {
                                  mission: mission.title,
                                  chapter: mission.chapter,
                                  note: mission.summary.text,
                                  competencies: mission.competencies.map(
                                      (competency) => ({
                                          code: competency.code,
                                          description: competency.description,
                                          status: competency.shown.status,
                                          by:
                                              competency.shown.decision === null
                                                  ? 'ai_estimate'
                                                  : 'teacher',
                                      }),
                                  ),
                              },
                          ]
                        : [],
                ),
            }),
            summaryIds: [...usable],
        },
    );

    return reply.code(202).send({ drafting: 'generating' });
}

export async function checkReport(
    request: FastifyRequest<{ Params: ReportParams; Body: CheckBody }>,
) {
    const { db } = request.server;
    const teacher = currentUser(request);
    const report = await ownedReport(db, teacher.id, request.params.reportId);
    const checkedAt = new Date();

    await db
        .update(reports)
        .set({ text: request.body.text, checkedBy: teacher.id, checkedAt })
        .where(eq(reports.id, report.id));

    return { id: report.id, text: request.body.text, checkedAt };
}

export async function excludeSummary(
    request: FastifyRequest<{ Params: SummaryParams; Body: ExcludedBody }>,
) {
    const { db } = request.server;
    const teacher = currentUser(request);
    const summary = await ownedSummary(
        db,
        teacher.id,
        request.params.summaryId,
    );

    await db.transaction(async (tx) => {
        await tx
            .update(learnerSummaries)
            .set(
                request.body.excluded
                    ? { excludedAt: new Date(), excludedBy: teacher.id }
                    : { excludedAt: null, excludedBy: null },
            )
            .where(eq(learnerSummaries.id, summary.id));
        await requeueForSummary(tx, summary.id);
    });

    return { id: summary.id, excluded: request.body.excluded };
}
