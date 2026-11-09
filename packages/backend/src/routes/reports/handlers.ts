import { and, eq, isNull, ne, or } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { currentUser } from '../../auth/guards.ts';
import {
    assessments,
    learnerSummaries,
    reports,
    verifications,
} from '../../db/schema.ts';
import { AppError } from '../../lib/errors.ts';
import {
    CLASS_REPORT_PROMPT,
    type ReportRequest,
    STUDENT_REPORT_PROMPT,
    startReportDraft,
} from '../../memory/reports.ts';
import { ownedClassId } from '../classes/queries.ts';
import type { ChapterParams } from '../classes/schema.ts';
import {
    chapterMap,
    ownedReport,
    ownedSummary,
    reportIn,
    type Scope,
    scopeOf,
    studentHistory,
} from './queries.ts';
import type {
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

async function ownedStudent(
    request: FastifyRequest<{ Params: ClassStudentParams }>,
) {
    const { db } = request.server;
    const classId = await ownedClassId(
        db,
        request.params.classId,
        currentUser(request).id,
    );

    return {
        classId,
        history: await studentHistory(db, classId, request.params.studentId),
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
    const { classId, history } = await ownedStudent(request);
    const { summaries, ...rest } = history;

    return {
        ...rest,
        summaryCount: summaries.length,
        report: await reportIn(
            request.server.db,
            { classId, moduleId: null, studentId: history.student.id },
            summaries.map(({ id }) => id),
        ),
    };
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

    await db
        .update(learnerSummaries)
        .set(
            request.body.excluded
                ? { excludedAt: new Date(), excludedBy: teacher.id }
                : { excludedAt: null, excludedBy: null },
        )
        .where(eq(learnerSummaries.id, summary.id));

    return { id: summary.id, excluded: request.body.excluded };
}
