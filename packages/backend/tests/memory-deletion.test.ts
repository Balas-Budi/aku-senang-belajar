import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
    analysisRuns,
    assessments,
    assignments,
    attempts,
    learnerSummaries,
    learningSessions,
    reports,
    users,
} from '../src/db/schema.ts';
import {
    claimSummary,
    processSummary,
    queueMissingSummaries,
} from '../src/memory/summaries.ts';
import { completion, stubProvider } from './ai-stub.ts';
import {
    demoClass,
    demoStudent,
    runFor,
    takeDemo,
    verdicts,
} from './demo-attempts.ts';
import { createUser, loginAs, TEST_ORIGIN, testApp } from './helpers.ts';

const summaryReply = {
    body: completion(
        JSON.stringify({
            summary:
                'C2 benar setelah satu petunjuk: siswa menjelaskan bahwa potongannya harus sama besar.',
        }),
    ),
};

async function remembered(
    t: TestContext,
    app: FastifyInstance,
    classId: number,
    assignmentId: number,
    name: string,
) {
    const student = await demoStudent(app, classId, name);
    const attemptId = await takeDemo(app, student.token, assignmentId);
    const provider = await stubProvider(t, [verdicts(), summaryReply]);

    await runFor(app, attemptId, provider.config);

    const claimed = await claimSummary(app.db, { embedding: false, attemptId });

    assert.ok(claimed);
    await processSummary(app, claimed, provider.config, null);
    await app.db
        .insert(reports)
        .values({ classId, studentId: student.id, draft: 'Laporan siswa.' });

    return { student, attemptId };
}

function summaryTexts(app: FastifyInstance, attemptId: number) {
    return app.db
        .select({ text: learnerSummaries.text })
        .from(learnerSummaries)
        .innerJoin(analysisRuns, eq(analysisRuns.id, learnerSummaries.runId))
        .where(eq(analysisRuns.attemptId, attemptId));
}

async function reportScopes(app: FastifyInstance, classId: number) {
    const rows = await app.db
        .select({ studentId: reports.studentId, moduleId: reports.moduleId })
        .from(reports)
        .where(eq(reports.classId, classId));

    return rows.map(({ studentId, moduleId }) =>
        studentId === null ? `chapter ${moduleId}` : `student ${studentId}`,
    );
}

function forget(app: FastifyInstance, token: string, studentId: number) {
    return app.inject({
        method: 'DELETE',
        url: `/api/admin/students/${studentId}/memory`,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
    });
}

test("an admin deletes one student's learner memory: their summaries and reports go, the evidence and the class report stay, and their missions are not summarised again", async (t) => {
    const app = await testApp(t);
    const { teacherToken, classId, assignmentId } = await demoClass(app);
    const [session] = await app.db
        .select({ moduleId: learningSessions.moduleId })
        .from(assignments)
        .innerJoin(
            learningSessions,
            eq(learningSessions.id, assignments.learningSessionId),
        )
        .where(eq(assignments.id, assignmentId));

    assert.ok(session);

    const wulan = await remembered(t, app, classId, assignmentId, 'Wulan Sari');
    const budi = await remembered(t, app, classId, assignmentId, 'Budi');

    await app.db.insert(reports).values({
        classId,
        moduleId: session.moduleId,
        draft: 'Laporan kelas.',
    });

    const admin = await createUser(app, 'admin');
    const adminToken = await loginAs(app, admin.username);
    const teacher = await createUser(app);

    for (const token of [teacherToken, wulan.student.token]) {
        assert.equal(
            (await forget(app, token, wulan.student.id)).statusCode,
            403,
        );
    }

    for (const other of [teacher.id, admin.id]) {
        assert.equal((await forget(app, adminToken, other)).statusCode, 404);
    }

    assert.equal(
        (await summaryTexts(app, wulan.attemptId)).length,
        1,
        'refused calls delete nothing',
    );
    assert.equal(
        (await forget(app, adminToken, wulan.student.id)).statusCode,
        204,
    );
    assert.deepEqual(await summaryTexts(app, wulan.attemptId), []);
    assert.equal((await summaryTexts(app, budi.attemptId)).length, 1);
    assert.deepEqual((await reportScopes(app, classId)).sort(), [
        `chapter ${session.moduleId}`,
        `student ${budi.student.id}`,
    ]);

    const kept = await app.db
        .select({ id: assessments.id })
        .from(assessments)
        .innerJoin(analysisRuns, eq(analysisRuns.id, assessments.runId))
        .where(eq(analysisRuns.attemptId, wulan.attemptId));

    assert.ok(kept.length > 0, 'the evidence and the estimates stay');
    assert.equal(
        await queueMissingSummaries(app.db, { attemptId: wulan.attemptId }),
        0,
    );

    await app.db.insert(analysisRuns).values({ attemptId: wulan.attemptId });
    await runFor(
        app,
        wulan.attemptId,
        (await stubProvider(t, [verdicts()])).config,
    );
    assert.deepEqual(
        await summaryTexts(app, wulan.attemptId),
        [],
        'a new analysis of an old mission writes no summary',
    );

    const history = async (studentId: number) => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/classes/${classId}/students/${studentId}/report`,
            cookies: { session: teacherToken },
        });

        assert.equal(response.statusCode, 200);

        const body: {
            missions: { summary: object | null; memoryDeleted: boolean }[];
            report: object | null;
        } = response.json();

        return body;
    };
    const forgotten = await history(wulan.student.id);
    const remembering = await history(budi.student.id);

    assert.deepEqual(
        forgotten.missions.map(({ summary, memoryDeleted }) => [
            summary,
            memoryDeleted,
        ]),
        [[null, true]],
    );
    assert.equal(forgotten.report, null);
    assert.deepEqual(
        remembering.missions.map(({ memoryDeleted }) => memoryDeleted),
        [false],
    );
    assert.ok(remembering.missions[0]?.summary);
    assert.ok(remembering.report);

    const [marked] = await app.db
        .select({ memoryDeletedAt: attempts.memoryDeletedAt })
        .from(attempts)
        .where(eq(attempts.id, wulan.attemptId));

    assert.ok(marked?.memoryDeletedAt);
});

test("deleting a student's row deletes their summaries and reports", async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId } = await demoClass(app);
    const { student, attemptId } = await remembered(
        t,
        app,
        classId,
        assignmentId,
        'Wulan Sari',
    );

    assert.equal((await summaryTexts(app, attemptId)).length, 1);
    await app.db.delete(users).where(eq(users.id, student.id));
    assert.deepEqual(await summaryTexts(app, attemptId), []);
    assert.deepEqual(await reportScopes(app, classId), []);
});
