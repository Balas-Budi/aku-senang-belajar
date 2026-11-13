import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AiConfig } from '../src/ai/chat.ts';
import type { EmbedConfig } from '../src/ai/embed.ts';
import {
    analysisRuns,
    assignments,
    attempts,
    classMembers,
    helpEvents,
    learnerAdaptations,
    learnerSummaries,
    responses,
    reviewTries,
    sessionBlocks,
    studentSettings,
    users,
} from '../src/db/schema.ts';
import {
    adaptationPair,
    followedPair,
    putFirstText,
} from '../src/learning/adaptation.ts';
import { demoModule } from '../src/learning/demo-module.ts';
import { seedModule } from '../src/learning/seed-module.ts';
import {
    checkSuggestion,
    claimAdaptation,
    keptSummaries,
    namesCode,
    processAdaptation,
    queueAdaptation,
    queueStudentAdaptation,
    SUGGESTION_PROMPT,
    suggestionAnswer,
} from '../src/memory/adaptations.ts';
import { claimSummary, processSummary } from '../src/memory/summaries.ts';
import {
    basis,
    completion,
    type ProviderRequest,
    stubEmbedder,
    stubProvider,
} from './ai-stub.ts';
import {
    asStudent,
    demoClass,
    demoStudent,
    keptSummary,
    runFor,
    takeDemo,
    verdicts,
} from './demo-attempts.ts';
import {
    createClass,
    createStudent,
    createUser,
    loginAs,
    TEST_ORIGIN,
    testApp,
} from './helpers.ts';

const nothing = {
    off: false,
    source: 'ai' as const,
    helpFirst: null,
    lead: null,
    aiHelpFirst: null,
    aiLead: null,
};

function rowsOf(app: FastifyInstance, studentId: number) {
    return app.db
        .select({
            classId: learnerAdaptations.classId,
            subject: learnerAdaptations.subject,
            queued: learnerAdaptations.queued,
            handled: learnerAdaptations.handled,
            tries: learnerAdaptations.tries,
            source: learnerAdaptations.source,
            off: learnerAdaptations.off,
            summaryIds: learnerAdaptations.summaryIds,
        })
        .from(learnerAdaptations)
        .where(eq(learnerAdaptations.studentId, studentId));
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

test('followedPair follows the teacher or the AI, and nothing when off or empty', () => {
    assert.equal(followedPair(undefined), null);
    assert.equal(followedPair(nothing), null);
    assert.deepEqual(
        followedPair({ ...nothing, aiHelpFirst: 'example', lead: 'text' }),
        { helpFirst: 'example', lead: null },
    );
    assert.deepEqual(
        followedPair({
            ...nothing,
            source: 'teacher',
            helpFirst: 'hint',
            aiHelpFirst: 'example',
            aiLead: 'audio',
        }),
        { helpFirst: 'hint', lead: null },
    );
    assert.equal(
        followedPair({
            ...nothing,
            off: true,
            source: 'teacher',
            helpFirst: 'example',
            lead: 'visual',
        }),
        null,
    );
    assert.equal(
        followedPair({ ...nothing, source: 'teacher', aiLead: 'audio' }),
        null,
    );
});

test('putFirstText names what a lesson put first in plain English', () => {
    assert.equal(putFirstText(null), 'nothing');
    assert.equal(putFirstText({ helpFirst: null, lead: null }), 'nothing');
    assert.equal(
        putFirstText({ helpFirst: 'example', lead: 'audio' }),
        'example first, read aloud',
    );
    assert.equal(putFirstText({ helpFirst: 'hint', lead: null }), 'hint first');
    assert.equal(
        putFirstText({ helpFirst: null, lead: 'visual' }),
        'picture first',
    );
    assert.equal(putFirstText({ helpFirst: null, lead: 'text' }), 'text first');
    assert.equal(adaptationPair.nullable().parse(null), null);
    assert.throws(() =>
        adaptationPair.parse({ helpFirst: 'video', lead: null }),
    );
});

test('namesCode matches a whole competency code only', () => {
    assert.equal(namesCode('C2 benar setelah petunjuk.', 'C2'), true);
    assert.equal(namesCode('Pada C2, siswa ragu.', 'C2'), true);
    assert.equal(namesCode('C21 belum terlihat.', 'C2'), false);
    assert.equal(namesCode('AC2 belum terlihat.', 'C2'), false);
    assert.equal(namesCode('Bab 3.C2 belum.', 'C2'), false);
    assert.equal(namesCode('Kode 3.1.a terlihat.', '3.1.a'), true);
    assert.equal(namesCode('Kode 3x1xa terlihat.', '3.1.a'), false);
});

test('keptSummaries lists the current class subject summaries newest first, without excluded, unwritten, or outdated ones', async (t) => {
    const app = await testApp(t);
    const { classId, teacherToken } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const keep = (days: number, more: object = {}) =>
        keptSummary(app, {
            studentId: student.id,
            classId,
            text: `Catatan ${days} hari lalu.`,
            writtenAt: daysAgo(days),
            ...more,
        });
    const older = await keep(3, { embedding: basis(0) });
    const newer = await keep(1);
    await keep(2, { excluded: true });

    const reanalysed = await keep(4);
    await app.db
        .insert(analysisRuns)
        .values({ attemptId: reanalysed.attemptId, status: 'queued' });

    const other = await createClass(app, teacherToken);
    const moved = await demoStudent(app, other.id);
    await keptSummary(app, {
        studentId: moved.id,
        classId: other.id,
        text: 'Catatan dari kelas lain.',
        writtenAt: daysAgo(1),
    });

    assert.deepEqual(await keptSummaries(app.db, student.id, 'mathematics'), [
        {
            id: newer.summaryId,
            attemptId: newer.attemptId,
            text: 'Catatan 1 hari lalu.',
            embedded: false,
        },
        {
            id: older.summaryId,
            attemptId: older.attemptId,
            text: 'Catatan 3 hari lalu.',
            embedded: true,
        },
    ]);
    assert.deepEqual(
        await keptSummaries(app.db, student.id, 'indonesian_language'),
        [],
    );

    await app.db
        .update(classMembers)
        .set({ classId: other.id })
        .where(eq(classMembers.studentId, student.id));
    assert.deepEqual(
        await keptSummaries(app.db, student.id, 'mathematics'),
        [],
        'a class the student left keeps its summaries out',
    );
});

test('queueAdaptation queues the student and subject once per call, and nothing for a class left or a memory deleted', async (t) => {
    const app = await testApp(t);
    const { classId, teacherToken } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const first = await keptSummary(app, {
        studentId: student.id,
        classId,
        text: 'Catatan pertama.',
        writtenAt: daysAgo(2),
    });
    const second = await keptSummary(app, {
        studentId: student.id,
        classId,
        text: 'Catatan kedua.',
        writtenAt: daysAgo(1),
    });

    await queueAdaptation(app.db, first.runId);
    assert.deepEqual(await rowsOf(app, student.id), [
        {
            classId,
            subject: 'mathematics',
            queued: 1,
            handled: 0,
            tries: 0,
            source: 'ai',
            off: false,
            summaryIds: [],
        },
    ]);

    await app.db
        .update(learnerAdaptations)
        .set({ tries: 3 })
        .where(eq(learnerAdaptations.studentId, student.id));
    await queueAdaptation(app.db, second.runId);
    assert.deepEqual(
        (await rowsOf(app, student.id)).map(({ queued, tries }) => ({
            queued,
            tries,
        })),
        [{ queued: 2, tries: 0 }],
    );

    await app.db
        .update(attempts)
        .set({ memoryDeletedAt: new Date() })
        .where(eq(attempts.id, second.attemptId));
    await queueAdaptation(app.db, second.runId);
    assert.equal((await rowsOf(app, student.id))[0]?.queued, 2);

    const other = await createClass(app, teacherToken);

    await app.db
        .update(classMembers)
        .set({ classId: other.id })
        .where(eq(classMembers.studentId, student.id));
    await queueAdaptation(app.db, first.runId);
    assert.equal(
        (await rowsOf(app, student.id))[0]?.queued,
        2,
        'a class the student left queues nothing',
    );
});

test('queueStudentAdaptation replaces a row of another class and the user deletion cascades', async (t) => {
    const app = await testApp(t);
    const { classId, teacherToken } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const other = await createClass(app, teacherToken);

    await app.db.insert(learnerAdaptations).values({
        studentId: student.id,
        classId,
        subject: 'mathematics',
        source: 'teacher',
        helpFirst: 'example',
        queued: 4,
        handled: 4,
    });
    await queueStudentAdaptation(app.db, student.id, other.id, 'mathematics');
    await queueStudentAdaptation(
        app.db,
        student.id,
        other.id,
        'indonesian_language',
    );

    const rows = await rowsOf(app, student.id);

    assert.deepEqual(
        rows
            .map(({ classId: id, subject, queued, source }) => ({
                classId: id,
                subject,
                queued,
                source,
            }))
            .sort((one, another) => one.subject.localeCompare(another.subject)),
        [
            {
                classId: other.id,
                subject: 'indonesian_language',
                queued: 1,
                source: 'ai',
            },
            {
                classId: other.id,
                subject: 'mathematics',
                queued: 1,
                source: 'ai',
            },
        ],
    );

    await app.db.delete(users).where(eq(users.id, student.id));
    assert.deepEqual(
        await app.db
            .select({ id: learnerAdaptations.id })
            .from(learnerAdaptations)
            .where(
                and(
                    eq(learnerAdaptations.studentId, student.id),
                    eq(learnerAdaptations.subject, 'mathematics'),
                ),
            ),
        [],
    );
});

const chosen = {
    helpFirst: 'example',
    lead: null,
    reason: 'Siswa benar setelah melihat contoh lain di dua misi.',
    refs: [1],
};

function suggestion(value: object = chosen, delay?: number) {
    return { body: completion(JSON.stringify(value)), delay };
}

async function rowOf(app: FastifyInstance, studentId: number) {
    const [row] = await app.db
        .select()
        .from(learnerAdaptations)
        .where(eq(learnerAdaptations.studentId, studentId));

    assert.ok(row, 'the student has an adaptation row');

    return row;
}

async function claimFor(
    app: FastifyInstance,
    given: { studentId: number; classId: number; attemptId: number },
) {
    await queueStudentAdaptation(
        app.db,
        given.studentId,
        given.classId,
        'mathematics',
    );

    const claimed = await claimAdaptation(app.db, {
        attemptId: given.attemptId,
    });

    assert.ok(claimed, 'the suggestion is due');

    return claimed;
}

async function suggest(
    app: FastifyInstance,
    given: { studentId: number; classId: number; attemptId: number },
    ai: AiConfig | null,
    embed: EmbedConfig | null = null,
) {
    await processAdaptation(app, await claimFor(app, given), ai, embed);
}

function sentOf(request: ProviderRequest | undefined) {
    assert.ok(request, 'the suggestion was requested');

    return JSON.parse(request.body.messages[1]?.content ?? '') as {
        notes: Record<string, unknown>[];
        counts: Record<string, unknown>;
    };
}

const notesOf = (request: ProviderRequest | undefined) =>
    sentOf(request).notes.map(({ note }) => note);

async function assignmentOf(
    app: FastifyInstance,
    classId: number,
    sessionId: number,
) {
    const [row] = await app.db
        .select({ id: assignments.id })
        .from(assignments)
        .where(
            and(
                eq(assignments.classId, classId),
                eq(assignments.learningSessionId, sessionId),
            ),
        );

    assert.ok(row);

    return row.id;
}

const counted = {
    questions: 2,
    firstTryRight: 1,
    rightLater: 1,
    shownAnswer: 0,
    rightAfter: {
        hint: { asked: 0, given: 1 },
        example: { asked: 0, given: 0 },
    },
    shownAfter: {
        hint: { asked: 0, given: 0 },
        example: { asked: 0, given: 0 },
    },
    listened: 0,
    withPicture: { questions: 1, firstTryRight: 0 },
    withoutPicture: { questions: 1, firstTryRight: 1 },
    readAloudLessons: 0,
    lessons: 2,
};

test('writing a summary queues a suggestion for its class, and the embed-only pass does not', async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const attemptId = await takeDemo(app, student.token, assignmentId);
    const provider = await stubProvider(t, [
        verdicts(),
        {
            body: completion(
                JSON.stringify({
                    summary:
                        'C2 benar setelah satu petunjuk: siswa lalu menjelaskan bahwa potongannya harus sama besar.',
                }),
            ),
        },
    ]);
    const embedder = await stubEmbedder(t, (texts) => ({
        vectors: texts.map((_, index) => basis(index)),
    }));

    await runFor(app, attemptId, provider.config);
    assert.deepEqual(await rowsOf(app, student.id), []);

    const writing = await claimSummary(app.db, { embedding: false, attemptId });

    assert.ok(writing);
    await processSummary(app, writing, provider.config, null);
    assert.deepEqual(
        (await rowsOf(app, student.id)).map(({ classId: id, queued }) => ({
            classId: id,
            queued,
        })),
        [{ classId, queued: 1 }],
    );

    const embedding = await claimSummary(app.db, {
        embedding: true,
        attemptId,
    });

    assert.ok(embedding);
    await processSummary(app, embedding, provider.config, embedder.config);
    assert.equal(embedder.requests.length, 1);
    assert.equal((await rowsOf(app, student.id))[0]?.queued, 1);
});

test('one kept summary makes no request and clears an older suggestion', async (t) => {
    const app = await testApp(t);
    const { classId } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const only = await keptSummary(app, {
        studentId: student.id,
        classId,
        text: 'Catatan satu.',
        embedding: basis(0),
        writtenAt: daysAgo(1),
    });
    const provider = await stubProvider(t, []);
    const embedder = await stubEmbedder(t, (texts) => ({
        vectors: texts.map(() => basis(0)),
    }));

    await app.db.insert(learnerAdaptations).values({
        studentId: student.id,
        classId,
        subject: 'mathematics',
        aiHelpFirst: 'example',
        aiReason: 'Alasan lama dari ringkasan lama.',
        summaryIds: [only.summaryId],
        suggestedAt: daysAgo(3),
    });
    await suggest(
        app,
        { studentId: student.id, classId, attemptId: only.attemptId },
        provider.config,
        embedder.config,
    );

    const row = await rowOf(app, student.id);

    assert.equal(provider.requests.length, 0);
    assert.equal(embedder.requests.length, 0);
    assert.deepEqual(
        {
            aiHelpFirst: row.aiHelpFirst,
            aiLead: row.aiLead,
            aiReason: row.aiReason,
            summaryIds: row.summaryIds,
            suggestedAt: row.suggestedAt,
            queued: row.queued,
            handled: row.handled,
            tries: row.tries,
        },
        {
            aiHelpFirst: null,
            aiLead: null,
            aiReason: null,
            summaryIds: [],
            suggestedAt: null,
            queued: 1,
            handled: 1,
            tries: 0,
        },
    );
});

test('two kept summaries ask once with notes and try counts, without the student, the class, or a reply key', async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const attemptId = await takeDemo(app, student.token, assignmentId);

    await runFor(app, attemptId, (await stubProvider(t, [verdicts()])).config);

    const [taken] = await app.db
        .update(learnerSummaries)
        .set({
            text: 'C2 benar setelah petunjuk pada misi pecahan.',
            writtenAt: new Date(),
        })
        .where(
            eq(
                learnerSummaries.runId,
                app.db
                    .select({ id: analysisRuns.id })
                    .from(analysisRuns)
                    .where(eq(analysisRuns.attemptId, attemptId)),
            ),
        )
        .returning({ id: learnerSummaries.id });
    const older = await keptSummary(app, {
        studentId: student.id,
        classId,
        text: 'C1 benar pada percobaan pertama.',
        writtenAt: daysAgo(1),
    });

    assert.ok(taken);

    const provider = await stubProvider(t, [suggestion(), suggestion()]);
    const given = { studentId: student.id, classId, attemptId };

    await suggest(app, given, provider.config);

    const request = provider.requests[0];
    const sent = sentOf(request);
    const row = await rowOf(app, student.id);

    assert.equal(provider.requests.length, 1);
    assert.equal(request?.body.messages[0]?.content, SUGGESTION_PROMPT);
    assert.deepEqual(sent.notes, [
        {
            ref: 1,
            note: 'C2 benar setelah petunjuk pada misi pecahan.',
            readAloud: false,
            putFirst: 'nothing',
        },
        {
            ref: 2,
            note: 'C1 benar pada percobaan pertama.',
            readAloud: false,
            putFirst: 'nothing',
        },
    ]);
    assert.deepEqual(sent.counts, counted);
    assert.doesNotMatch(
        request?.body.messages[1]?.content ?? '',
        /"(helpFirst|lead|reason|refs)":/,
    );

    for (const withheld of [
        'Wulan',
        student.username,
        'Kelas 4A',
        demoModule.session.title,
    ]) {
        assert.equal(
            request?.text.includes(withheld),
            false,
            `the model received ${withheld}`,
        );
    }

    assert.deepEqual(
        {
            aiHelpFirst: row.aiHelpFirst,
            aiLead: row.aiLead,
            aiReason: row.aiReason,
            summaryIds: row.summaryIds,
            model: row.model,
            promptVersion: row.promptVersion,
            handled: row.handled,
            tries: row.tries,
        },
        {
            aiHelpFirst: 'example',
            aiLead: null,
            aiReason: chosen.reason,
            summaryIds: [taken.id, older.summaryId],
            model: 'provider-model-name',
            promptVersion: 'suggestion-2026-11-13-compact',
            handled: 1,
            tries: 0,
        },
    );
    assert.ok(row.suggestedAt);

    const [firstTry] = await app.db
        .select({ blockId: responses.blockId, at: responses.createdAt })
        .from(responses)
        .innerJoin(sessionBlocks, eq(sessionBlocks.id, responses.blockId))
        .where(
            and(
                eq(responses.attemptId, attemptId),
                eq(sessionBlocks.kind, 'check'),
                eq(responses.outcome, 'correct'),
                eq(responses.tryNumber, 1),
            ),
        );

    assert.ok(firstTry, 'one check was right on the first try');
    await app.db.insert(helpEvents).values({
        attemptId,
        blockId: firstTry.blockId,
        kind: 'hint',
        createdAt: new Date(firstTry.at.getTime() - 1_000),
    });
    await suggest(app, given, provider.config);
    assert.deepEqual(sentOf(provider.requests[1]).counts, {
        ...counted,
        firstTryRight: 0,
        rightLater: 2,
        rightAfter: {
            hint: { asked: 1, given: 1 },
            example: { asked: 0, given: 0 },
        },
        withoutPicture: { questions: 1, firstTryRight: 0 },
    });
});

test('a reply outside the closed set is repaired once, and a second bad reply waits and keeps the previous suggestion', async (t) => {
    const app = await testApp(t);
    const { classId } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const keep = (days: number) =>
        keptSummary(app, {
            studentId: student.id,
            classId,
            text: `Catatan ${days} hari lalu.`,
            writtenAt: daysAgo(days),
        });
    const newest = await keep(1);

    await keep(2);

    const given = {
        studentId: student.id,
        classId,
        attemptId: newest.attemptId,
    };
    const video = { ...chosen, helpFirst: 'video' };
    const provider = await stubProvider(t, [
        suggestion(video),
        suggestion(),
        suggestion({ ...chosen, reason: null }),
        suggestion({ ...chosen, lead: 'visual', refs: [2] }),
        suggestion(video),
        suggestion(video),
    ]);

    await suggest(app, given, provider.config);
    assert.match(
        provider.requests[1]?.body.messages.at(-1)?.content ?? '',
        /helpFirst/,
    );
    assert.equal((await rowOf(app, student.id)).aiHelpFirst, 'example');

    await suggest(app, given, provider.config);
    assert.match(
        provider.requests[3]?.body.messages.at(-1)?.content ?? '',
        /Give a reason for your choice, naming the evidence\./,
    );
    assert.equal((await rowOf(app, student.id)).aiLead, 'visual');

    const summariesBefore = await app.db
        .select()
        .from(learnerSummaries)
        .where(eq(learnerSummaries.id, newest.summaryId));
    const started = Date.now();

    await suggest(app, given, provider.config);

    const failed = await rowOf(app, student.id);

    assert.equal(provider.requests.length, 6);
    assert.equal(failed.aiHelpFirst, 'example');
    assert.equal(failed.aiLead, 'visual');
    assert.equal(failed.tries, 1);
    assert.equal(failed.handled, 2);
    assert.equal(failed.queued, 3);
    assert.ok(failed.runAfter.getTime() >= started + 59_000);
    assert.deepEqual(
        await app.db
            .select()
            .from(learnerSummaries)
            .where(eq(learnerSummaries.id, newest.summaryId)),
        summariesBefore,
    );
    assert.equal(
        await claimAdaptation(app.db, { attemptId: newest.attemptId }),
        null,
    );
});

test('checkSuggestion asks for a reason, refs, and known refs, and accepts nothing or a cited choice', () => {
    const check = checkSuggestion([1, 2]);
    const reason = 'Siswa benar setelah contoh lain.';

    assert.deepEqual(
        suggestionAnswer.parse({
            helpFirst: null,
            lead: null,
            reason: '  ',
            refs: [],
        }),
        { helpFirst: null, lead: null, reason: null, refs: [] },
        'a blank reason reads as no reason',
    );

    assert.equal(
        check({ helpFirst: 'example', lead: null, reason: null, refs: [1] }),
        'Give a reason for your choice, naming the evidence.',
    );
    assert.equal(
        check({ helpFirst: null, lead: null, reason, refs: [] }),
        'Leave reason null when you choose nothing.',
    );
    assert.equal(
        check({ helpFirst: null, lead: 'text', reason, refs: [] }),
        'Name in refs the notes your reason rests on.',
    );
    assert.equal(
        check({ helpFirst: 'hint', lead: null, reason, refs: [1, 3] }),
        'Ref 3 is not among the notes you received.',
    );
    assert.equal(
        check({ helpFirst: 'example', lead: 'audio', reason, refs: [2] }),
        null,
    );
    assert.equal(
        check({ helpFirst: null, lead: null, reason: null, refs: [] }),
        null,
    );
});

test('the newest five notes come with the older kept notes nearest to the next mission', async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId, teacherToken } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const keep = (
        text: string,
        days: number,
        more: {
            embedding?: number[];
            excluded?: boolean;
            assignmentId?: number;
        } = {},
    ) =>
        keptSummary(app, {
            studentId: student.id,
            classId,
            text,
            writtenAt: daysAgo(days),
            ...more,
        });
    const newest = [];

    for (const index of [0, 1, 2, 3, 4]) {
        newest.push(
            await keep(`Baru ${index}.`, index + 1, {
                embedding: basis(index),
            }),
        );
    }

    await keep('Lama 5.', 6, { embedding: basis(5) });
    await keep('Lama 6.', 7, { embedding: basis(6) });
    await keep('Tanpa embedding.', 8);
    await keep('Dikecualikan.', 9, { embedding: basis(7), excluded: true });

    for (const index of [8, 9, 10]) {
        await keep(`Lama ${index}.`, index + 2, { embedding: basis(index) });
    }

    await keep('Paling lama dan paling dekat.', 20, { embedding: basis(7) });

    const language = await seedModule(app.db, classId, {
        ...demoModule,
        subject: 'indonesian_language',
        material: `Demo module ${randomUUID()}`,
    });

    await keep('Mata pelajaran lain.', 1, {
        embedding: basis(7),
        assignmentId: await assignmentOf(app, classId, language.sessionId),
    });

    const other = await createClass(app, teacherToken);
    const stranger = await demoStudent(app, other.id, 'Rina Ayu');

    for (const index of [1, 2, 3]) {
        await keptSummary(app, {
            studentId: stranger.id,
            classId: other.id,
            text: `Siswa lain ${index}.`,
            embedding: basis(7),
            writtenAt: daysAgo(index),
        });
    }

    const next = [...demoModule.competencies]
        .sort((one, another) => one.code.localeCompare(another.code))
        .map(({ code, description }) => `${code}: ${description}`)
        .join(' ');
    const embedder = await stubEmbedder(t, (texts) => ({
        vectors: texts.map((text) => (text === next ? basis(7) : basis(99))),
    }));
    const failing = await stubEmbedder(t, () => ({ status: 500 }));
    const provider = await stubProvider(t, [
        suggestion(),
        suggestion(),
        suggestion(),
        suggestion(),
    ]);
    const given = {
        studentId: student.id,
        classId,
        attemptId: newest[0]?.attemptId ?? 0,
    };
    const newestNotes = ['Baru 0.', 'Baru 1.', 'Baru 2.', 'Baru 3.', 'Baru 4.'];

    await suggest(app, given, provider.config, embedder.config);
    assert.deepEqual(embedder.requests[0]?.body.input, [next]);
    assert.deepEqual(notesOf(provider.requests[0]), [
        ...newestNotes,
        'Paling lama dan paling dekat.',
        'Lama 5.',
        'Lama 6.',
        'Lama 8.',
        'Lama 9.',
    ]);

    await suggest(app, given, provider.config, null);
    assert.deepEqual(notesOf(provider.requests[1]), newestNotes);

    await suggest(app, given, provider.config, failing.config);
    assert.equal(failing.requests.length, 1);
    assert.deepEqual(notesOf(provider.requests[2]), newestNotes);
    assert.ok((await rowOf(app, student.id)).suggestedAt);

    await keep('Misi berikutnya sudah selesai.', 30, { assignmentId });
    await suggest(app, given, provider.config, embedder.config);
    assert.equal(embedder.requests.length, 1);
    assert.deepEqual(notesOf(provider.requests[3]), newestNotes);
});

test('a summary excluded while the suggestion runs stores nothing, and the next run leaves it out', async (t) => {
    const app = await testApp(t);
    const { classId, teacherToken } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const keep = (days: number) =>
        keptSummary(app, {
            studentId: student.id,
            classId,
            text: `Catatan ${days} hari lalu.`,
            writtenAt: daysAgo(days),
        });
    const first = await keep(1);
    const second = await keep(2);
    const third = await keep(3);
    let excludedFirst = () => {};
    const gate = new Promise<void>((done) => {
        excludedFirst = () => done();
    });
    const provider = await stubProvider(t, [
        { ...suggestion(chosen), gate },
        suggestion(),
    ]);
    const exclude = (excluded: boolean) =>
        app.inject({
            method: 'PUT',
            url: `/api/learner-summaries/${second.summaryId}/excluded`,
            headers: { origin: TEST_ORIGIN },
            cookies: { session: teacherToken },
            payload: { excluded },
        });
    const claimed = await claimFor(app, {
        studentId: student.id,
        classId,
        attemptId: first.attemptId,
    });
    const running = processAdaptation(app, claimed, provider.config, null);
    const deadline = Date.now() + 5_000;

    while (provider.requests.length === 0) {
        assert.ok(Date.now() < deadline, 'the request was not sent');
        await new Promise((resolve) => setTimeout(resolve, 10));
    }

    assert.equal((await exclude(true)).statusCode, 200);
    excludedFirst();
    await running;

    const waiting = await rowOf(app, student.id);

    assert.equal(waiting.suggestedAt, null);
    assert.equal(waiting.aiHelpFirst, null);
    assert.equal(waiting.queued, 2);
    assert.equal(waiting.handled, 0);
    assert.ok(waiting.runAfter.getTime() <= Date.now());

    const again = await claimAdaptation(app.db, {
        attemptId: first.attemptId,
    });

    assert.ok(again);
    await processAdaptation(app, again, provider.config, null);
    assert.deepEqual(notesOf(provider.requests[1]), [
        'Catatan 1 hari lalu.',
        'Catatan 3 hari lalu.',
    ]);

    const stored = await rowOf(app, student.id);

    assert.deepEqual(stored.summaryIds, [first.summaryId, third.summaryId]);
    assert.equal(stored.aiHelpFirst, 'example');
    assert.equal(stored.handled, 2);

    assert.equal((await exclude(false)).statusCode, 200);

    const cleared = await rowOf(app, student.id);

    assert.equal(cleared.aiHelpFirst, null);
    assert.equal(cleared.aiReason, null);
    assert.deepEqual(cleared.summaryIds, []);
    assert.equal(cleared.suggestedAt, null);
    assert.equal(cleared.queued, 3);
});

test('a row switched off or left behind by a class change makes no request', async (t) => {
    const app = await testApp(t);
    const { classId, teacherToken } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const keep = (days: number) =>
        keptSummary(app, {
            studentId: student.id,
            classId,
            text: `Catatan ${days} hari lalu.`,
            writtenAt: daysAgo(days),
        });
    const newest = await keep(1);

    await keep(2);

    const provider = await stubProvider(t, []);
    const given = {
        studentId: student.id,
        classId,
        attemptId: newest.attemptId,
    };

    await app.db.insert(learnerAdaptations).values({
        studentId: student.id,
        classId,
        subject: 'mathematics',
        off: true,
    });
    await suggest(app, given, provider.config);

    const off = await rowOf(app, student.id);

    assert.equal(provider.requests.length, 0);
    assert.equal(off.handled, off.queued);
    assert.equal(off.tries, 0);
    assert.equal(off.off, true);

    await app.db
        .update(learnerAdaptations)
        .set({ off: false })
        .where(eq(learnerAdaptations.studentId, student.id));

    const claimed = await claimFor(app, given);
    const other = await createClass(app, teacherToken);

    await app.db
        .update(classMembers)
        .set({ classId: other.id })
        .where(eq(classMembers.studentId, student.id));
    await processAdaptation(app, claimed, provider.config, null);
    assert.equal(provider.requests.length, 0);
    assert.deepEqual(await rowsOf(app, student.id), []);
});

type Earned = {
    hints: unknown[];
    example: unknown;
    praise: string | null;
    reveal: { answer: string; text: string } | null;
};
type Started = { id: number; adaptation: unknown };

async function attemptRow(app: FastifyInstance, attemptId: number) {
    const [row] = await app.db
        .select({
            adaptation: attempts.adaptation,
            readAloud: attempts.readAloud,
        })
        .from(attempts)
        .where(eq(attempts.id, attemptId));

    return row;
}

function demoCheck(index: number) {
    const block = demoModule.blocks.filter(({ kind }) => kind === 'check')[
        index
    ];

    if (block?.kind !== 'check') {
        throw new Error(`The demo has no check ${index + 1}`);
    }

    return block.content;
}

async function checkIds(
    app: FastifyInstance,
    token: string,
    assignmentId: number,
) {
    const detail = await asStudent(
        app,
        token,
        'GET',
        `/assignments/${assignmentId}`,
    );
    const body: {
        blocks: { id: number; kind: string }[];
        attempt: Started | null;
    } = detail.json();

    return {
        body: detail.body,
        attempt: body.attempt,
        checks: body.blocks
            .filter(({ kind }) => kind === 'check')
            .map(({ id }) => id),
    };
}

function helpOf(app: FastifyInstance, attemptId: number) {
    return app.db
        .select({
            blockId: helpEvents.blockId,
            kind: helpEvents.kind,
            given: helpEvents.given,
        })
        .from(helpEvents)
        .where(eq(helpEvents.attemptId, attemptId))
        .orderBy(asc(helpEvents.id));
}

test('the next mission follows the pair fixed at its start: the example first, read aloud, and the same pair on a restart', async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const pair = { helpFirst: 'example', lead: 'audio' };

    await app.db.insert(learnerAdaptations).values({
        studentId: student.id,
        classId,
        subject: 'mathematics',
        aiHelpFirst: 'example',
        aiLead: 'audio',
        aiReason: 'Alasan rahasia untuk guru saja.',
        suggestedAt: new Date(),
    });

    const start = () =>
        asStudent(
            app,
            student.token,
            'POST',
            `/assignments/${assignmentId}/attempt`,
        );
    const started = await start();
    const attempt: Started = started.json();

    assert.equal(started.statusCode, 201);
    assert.deepEqual(attempt.adaptation, pair);
    assert.deepEqual(await attemptRow(app, attempt.id), {
        adaptation: pair,
        readAloud: true,
    });

    const detail = await checkIds(app, student.token, assignmentId);
    const [first = 0, second = 0] = detail.checks;

    assert.deepEqual(detail.attempt?.adaptation, pair);

    for (const hidden of [
        'aiReason',
        'Alasan rahasia',
        '"source"',
        'suggestedAt',
    ]) {
        assert.equal(detail.body.includes(hidden), false, hidden);
    }

    const asked = await asStudent(
        app,
        student.token,
        'POST',
        `/attempts/${attempt.id}/help`,
        { blockId: second, kind: 'hint' },
    );

    assert.equal(asked.statusCode, 201);

    const wrong = async (tryNumber: number) => {
        const response = await asStudent(
            app,
            student.token,
            'POST',
            `/attempts/${attempt.id}/responses`,
            {
                blockId: first,
                tryNumber,
                answer: {
                    kind: 'check',
                    choice: 'a',
                    reason: 'Karena dipotong empat',
                },
            },
        );

        assert.equal(response.statusCode, 201);

        const feedback: { earned: Earned } = response.json();

        return feedback.earned;
    };
    const content = demoCheck(0);

    assert.deepEqual(await wrong(1), {
        hints: [],
        example: content.example,
        praise: null,
        reveal: null,
    });
    assert.deepEqual(await wrong(2), {
        hints: content.hints.slice(0, 1),
        example: content.example,
        praise: null,
        reveal: null,
    });
    assert.deepEqual(await wrong(3), {
        hints: content.hints.slice(0, 1),
        example: content.example,
        praise: null,
        reveal: { answer: content.answer, text: content.reveal },
    });
    assert.deepEqual(await helpOf(app, attempt.id), [
        { blockId: second, kind: 'hint', given: false },
        { blockId: first, kind: 'example', given: true },
        { blockId: first, kind: 'hint', given: true },
        { blockId: first, kind: 'reveal', given: true },
    ]);

    await app.db
        .update(learnerAdaptations)
        .set({ aiHelpFirst: null, aiLead: 'visual' })
        .where(eq(learnerAdaptations.studentId, student.id));

    const again = await start();
    const restarted: Started = again.json();

    assert.equal(again.statusCode, 200);
    assert.equal(restarted.id, attempt.id);
    assert.deepEqual(restarted.adaptation, pair);
    assert.deepEqual(await attemptRow(app, attempt.id), {
        adaptation: pair,
        readAloud: true,
    });
});

test('the own Bacakan otomatis choice of the student beats a read-aloud lead, and without a row of the current class the help stays as today', async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId, teacherToken } = await demoClass(app);
    const other = await createClass(app, teacherToken);
    const startedBy = async (
        name: string,
        readAloud: boolean | null,
        row: Pick<
            typeof learnerAdaptations.$inferInsert,
            'aiHelpFirst' | 'aiLead'
        >,
        rowClassId = classId,
    ) => {
        const student = await demoStudent(app, classId, name);

        if (readAloud !== null) {
            await app.db.insert(studentSettings).values({
                studentId: student.id,
                readAloud,
                readAloudChosen: true,
            });
        }

        await app.db.insert(learnerAdaptations).values({
            studentId: student.id,
            classId: rowClassId,
            subject: 'mathematics',
            ...row,
        });

        const response = await asStudent(
            app,
            student.token,
            'POST',
            `/assignments/${assignmentId}/attempt`,
        );
        const attempt: Started = response.json();

        assert.equal(response.statusCode, 201);

        return {
            token: student.token,
            attempt,
            stored: await attemptRow(app, attempt.id),
        };
    };
    const examplePair = { aiHelpFirst: 'example', aiLead: 'audio' } as const;
    const exampleOnly = { helpFirst: 'example', lead: null };

    const quiet = await startedBy('Ayu', false, examplePair);

    assert.deepEqual(quiet.attempt.adaptation, exampleOnly);
    assert.deepEqual(quiet.stored, {
        adaptation: exampleOnly,
        readAloud: false,
    });

    const reading = await startedBy('Bagus', true, examplePair);

    assert.deepEqual(reading.stored, {
        adaptation: exampleOnly,
        readAloud: true,
    });

    const audioOnly = await startedBy('Citra', false, {
        aiHelpFirst: null,
        aiLead: 'audio',
    });

    assert.deepEqual(audioOnly.stored, { adaptation: null, readAloud: false });

    const moved = await startedBy('Dewi', null, examplePair, other.id);

    assert.equal(moved.attempt.adaptation, null);
    assert.deepEqual(moved.stored, { adaptation: null, readAloud: false });

    const { checks } = await checkIds(app, moved.token, assignmentId);
    const response = await asStudent(
        app,
        moved.token,
        'POST',
        `/attempts/${moved.attempt.id}/responses`,
        {
            blockId: checks[0],
            tryNumber: 1,
            answer: {
                kind: 'check',
                choice: 'a',
                reason: 'Karena dipotong empat',
            },
        },
    );

    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.json(), {
        outcome: 'not_yet',
        inPlace: null,
        earned: {
            hints: demoCheck(0).hints.slice(0, 1),
            example: null,
            praise: null,
            reveal: null,
        },
    });
    assert.deepEqual(await helpOf(app, moved.attempt.id), [
        { blockId: checks[0], kind: 'hint', given: true },
    ]);
});

type Item = {
    subject: string;
    helpFirst: string | null;
    lead: string | null;
    source: string;
    off: boolean;
    pending: boolean;
    failed: boolean;
    thin: boolean;
    readAloudChosen: boolean;
    ai: {
        helpFirst: string | null;
        lead: string | null;
        reason: string | null;
        suggestedAt: string;
    } | null;
    teacher: { helpFirst: string; lead: string | null; setAt: string } | null;
};

function asTeacher(
    app: FastifyInstance,
    token: string,
    method: 'GET' | 'PUT',
    url: string,
    payload?: object,
) {
    return app.inject({
        method,
        url: `/api${url}`,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
        payload,
    });
}

const empty = {
    helpFirst: null,
    lead: null,
    source: 'ai',
    off: false,
    pending: false,
    failed: false,
    ai: null,
    teacher: null,
};

function withoutDates({ ai, teacher, ...item }: Item) {
    return {
        ...item,
        ai: ai && { helpFirst: ai.helpFirst, lead: ai.lead, reason: ai.reason },
        teacher: teacher && {
            helpFirst: teacher.helpFirst,
            lead: teacher.lead,
        },
    };
}

async function freshMission(app: FastifyInstance, classId: number) {
    const { sessionId } = await seedModule(app.db, classId, {
        ...demoModule,
        material: `Demo module ${randomUUID()}`,
    });

    return assignmentOf(app, classId, sessionId);
}

test('a teacher setting is kept beside the AI suggestion, followed by the next start, switched off, and returned to the AI', async (t) => {
    const app = await testApp(t);
    const { classId, teacher, teacherToken } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const newest = await keptSummary(app, {
        studentId: student.id,
        classId,
        text: 'Catatan kemarin.',
        writtenAt: daysAgo(1),
    });

    await keptSummary(app, {
        studentId: student.id,
        classId,
        text: 'Catatan dua hari lalu.',
        writtenAt: daysAgo(2),
    });

    const put = async (body: object) => {
        const response = await asTeacher(
            app,
            teacherToken,
            'PUT',
            `/classes/${classId}/students/${student.id}/adaptations/mathematics`,
            body,
        );

        assert.equal(response.statusCode, 200, response.body);

        const item: Item = response.json();

        return item;
    };
    const startNext = async () => {
        const assignmentId = await freshMission(app, classId);
        const response = await asStudent(
            app,
            student.token,
            'POST',
            `/assignments/${assignmentId}/attempt`,
        );
        const started: Started = response.json();

        assert.equal(response.statusCode, 201);

        return started.adaptation;
    };
    const settled = {
        subject: 'mathematics',
        thin: false,
        readAloudChosen: false,
    };

    const visual = await put({ helpFirst: 'example', lead: 'visual' });

    assert.deepEqual(withoutDates(visual), {
        ...settled,
        ...empty,
        helpFirst: 'example',
        lead: 'visual',
        source: 'teacher',
        teacher: { helpFirst: 'example', lead: 'visual' },
    });
    assert.ok(visual.teacher?.setAt);

    const stored = await rowOf(app, student.id);

    assert.equal(stored.setBy, teacher.id);
    assert.equal(stored.classId, classId);
    assert.equal(stored.queued, 0, 'a teacher pair asks the AI nothing');

    await put({ helpFirst: 'example', lead: null });
    assert.deepEqual(await startNext(), { helpFirst: 'example', lead: null });

    const provider = await stubProvider(t, [
        suggestion({
            helpFirst: 'hint',
            lead: 'text',
            reason: 'Siswa benar setelah petunjuk di dua misi.',
            refs: [1, 2],
        }),
    ]);

    await suggest(
        app,
        { studentId: student.id, classId, attemptId: newest.attemptId },
        provider.config,
    );

    const suggested = await rowOf(app, student.id);

    assert.equal(provider.requests.length, 1);
    assert.deepEqual(
        {
            aiHelpFirst: suggested.aiHelpFirst,
            aiLead: suggested.aiLead,
            helpFirst: suggested.helpFirst,
            lead: suggested.lead,
            source: suggested.source,
        },
        {
            aiHelpFirst: 'hint',
            aiLead: 'text',
            helpFirst: 'example',
            lead: null,
            source: 'teacher',
        },
    );
    assert.deepEqual(await startNext(), { helpFirst: 'example', lead: null });

    const queuedBefore = suggested.queued;
    const back = await put({ source: 'ai' });

    assert.deepEqual(withoutDates(back), {
        ...settled,
        ...empty,
        helpFirst: 'hint',
        lead: 'text',
        pending: true,
        ai: {
            helpFirst: 'hint',
            lead: 'text',
            reason: 'Siswa benar setelah petunjuk di dua misi.',
        },
    });
    assert.equal((await rowOf(app, student.id)).queued, queuedBefore + 1);
    assert.deepEqual(await startNext(), { helpFirst: 'hint', lead: 'text' });

    const off = await put({ off: true });

    assert.equal(off.off, true);
    assert.equal(off.helpFirst, null);
    assert.equal(off.lead, null);
    assert.equal((await rowOf(app, student.id)).queued, queuedBefore + 1);
    assert.equal(await startNext(), null);

    const on = await put({ off: false });

    assert.equal(on.off, false);
    assert.deepEqual([on.helpFirst, on.lead], ['hint', 'text']);
    assert.equal(
        (await rowOf(app, student.id)).queued,
        queuedBefore + 2,
        'switching on asks the AI again',
    );

    await app.db
        .update(learnerAdaptations)
        .set({ tries: 1, runAfter: new Date(Date.now() + 60_000) })
        .where(eq(learnerAdaptations.studentId, student.id));
    await put({ off: false });
    await put({ source: 'ai' });

    const waiting = await rowOf(app, student.id);

    assert.deepEqual(
        [waiting.queued, waiting.tries],
        [queuedBefore + 2, 1],
        'repeating a setting keeps the retry count and asks the AI nothing more',
    );
    assert.ok(waiting.runAfter.getTime() > Date.now());

    await app.db
        .update(learnerAdaptations)
        .set({ tries: 3 })
        .where(eq(learnerAdaptations.studentId, student.id));
    await put({ off: false });

    const retried = await rowOf(app, student.id);

    assert.deepEqual(
        [retried.queued, retried.tries],
        [queuedBefore + 3, 0],
        'a failed suggestion can be asked again',
    );
});

test('the adaptation PUT refuses another class, a student outside it, a student caller, and a body or subject outside the closed set', async (t) => {
    const app = await testApp(t);
    const { classId, teacherToken } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const left = await demoStudent(app, classId, 'Ayu');
    const removed = await demoStudent(app, classId, 'Bagus');
    const stranger = await createStudent(app, 'Citra');
    const otherTeacher = await createUser(app);
    const otherClass = await createClass(
        app,
        await loginAs(app, otherTeacher.username),
    );
    const ownOther = await createClass(app, teacherToken);
    const body = { helpFirst: 'example', lead: 'text' };
    const put = (
        token: string,
        studentId: number,
        payload: object = body,
        subject = 'mathematics',
        inClass = classId,
    ) =>
        asTeacher(
            app,
            token,
            'PUT',
            `/classes/${inClass}/students/${studentId}/adaptations/${subject}`,
            payload,
        );

    await app.db
        .update(classMembers)
        .set({ classId: ownOther.id })
        .where(eq(classMembers.studentId, left.id));
    await app.db
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.id, removed.id));

    const refused: [Promise<{ statusCode: number }>, number, string][] = [
        [
            put(teacherToken, student.id, body, 'mathematics', otherClass.id),
            404,
            'another teacher class',
        ],
        [put(teacherToken, stranger.id), 404, 'a student outside the class'],
        [put(teacherToken, left.id), 404, 'a student who left'],
        [put(teacherToken, removed.id), 404, 'a deleted student'],
        [put(student.token, student.id), 403, 'a student caller'],
        [put(teacherToken, student.id, body, 'art'), 400, 'unknown subject'],
        [
            put(teacherToken, student.id, { helpFirst: 'video', lead: 'text' }),
            400,
            'help outside the set',
        ],
        [put(teacherToken, student.id, { helpFirst: 'hint' }), 400, 'no lead'],
        [put(teacherToken, student.id, {}), 400, 'empty body'],
        [
            put(teacherToken, student.id, { off: true, source: 'ai' }),
            400,
            'two shapes at once',
        ],
    ];

    for (const [response, status, label] of refused) {
        assert.equal((await response).statusCode, status, label);
    }

    for (const id of [student.id, left.id, removed.id, stranger.id]) {
        assert.deepEqual(await rowsOf(app, id), []);
    }
});

test('the student report lists each subject of the class with what the next mission follows and the suggestion state', async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId, teacherToken } = await demoClass(app);
    const previous = await createClass(app, teacherToken);
    const student = await demoStudent(app, classId);
    const itemsOf = async () => {
        const response = await asTeacher(
            app,
            teacherToken,
            'GET',
            `/classes/${classId}/students/${student.id}/report`,
        );

        assert.equal(response.statusCode, 200, response.body);

        const report: { adaptations: Item[] } = response.json();

        return report.adaptations.map(withoutDates);
    };
    const math = { subject: 'mathematics', thin: true, readAloudChosen: false };

    assert.deepEqual(await itemsOf(), [{ ...math, ...empty }]);

    await app.db.insert(learnerAdaptations).values({
        studentId: student.id,
        classId: previous.id,
        subject: 'mathematics',
        source: 'teacher',
        helpFirst: 'example',
        lead: 'visual',
        setAt: new Date(),
    });
    assert.deepEqual(
        await itemsOf(),
        [{ ...math, ...empty }],
        'a row of the previous class shows as empty',
    );

    const started = await asStudent(
        app,
        student.token,
        'POST',
        `/assignments/${assignmentId}/attempt`,
    );
    const attempt: Started = started.json();

    assert.equal(attempt.adaptation, null, 'and is not followed');

    await app.db
        .delete(learnerAdaptations)
        .where(eq(learnerAdaptations.studentId, student.id));
    await app.db.insert(studentSettings).values({
        studentId: student.id,
        readAloud: false,
        readAloudChosen: true,
    });
    await app.db.insert(learnerAdaptations).values([
        {
            studentId: student.id,
            classId,
            subject: 'mathematics',
            aiHelpFirst: 'example',
            aiLead: 'audio',
            aiReason: 'Siswa benar setelah contoh lain di dua misi.',
            suggestedAt: new Date(),
            queued: 1,
            handled: 1,
        },
        {
            studentId: student.id,
            classId,
            subject: 'indonesian_language',
            off: true,
        },
    ]);
    await keptSummary(app, {
        studentId: student.id,
        classId,
        text: 'Catatan satu.',
        writtenAt: daysAgo(1),
    });
    await keptSummary(app, {
        studentId: student.id,
        classId,
        text: 'Catatan dua.',
        writtenAt: daysAgo(2),
    });

    const suggested = {
        helpFirst: 'example',
        lead: 'audio',
        reason: 'Siswa benar setelah contoh lain di dua misi.',
    };
    const chosenMath = { ...math, thin: false, readAloudChosen: true };
    const language = {
        subject: 'indonesian_language',
        thin: true,
        readAloudChosen: true,
        ...empty,
        off: true,
    };

    assert.deepEqual(await itemsOf(), [
        {
            ...chosenMath,
            ...empty,
            helpFirst: 'example',
            lead: 'audio',
            ai: suggested,
        },
        language,
    ]);

    const mathState = async (
        values: Partial<typeof learnerAdaptations.$inferInsert>,
    ) => {
        await app.db
            .update(learnerAdaptations)
            .set(values)
            .where(
                and(
                    eq(learnerAdaptations.studentId, student.id),
                    eq(learnerAdaptations.subject, 'mathematics'),
                ),
            );

        return (await itemsOf())[0];
    };

    assert.deepEqual(await mathState({ queued: 2 }), {
        ...chosenMath,
        ...empty,
        helpFirst: 'example',
        lead: 'audio',
        pending: true,
        ai: suggested,
    });
    assert.deepEqual(await mathState({ tries: 3 }), {
        ...chosenMath,
        ...empty,
        helpFirst: 'example',
        lead: 'audio',
        failed: true,
        ai: suggested,
    });
    assert.deepEqual(
        await mathState({
            queued: 2,
            handled: 2,
            tries: 0,
            source: 'teacher',
            helpFirst: 'hint',
            lead: null,
            setAt: new Date(),
        }),
        {
            ...chosenMath,
            ...empty,
            helpFirst: 'hint',
            source: 'teacher',
            ai: suggested,
            teacher: { helpFirst: 'hint', lead: null },
        },
    );
    assert.deepEqual(await mathState({ off: true }), {
        ...chosenMath,
        ...empty,
        source: 'teacher',
        off: true,
        ai: suggested,
        teacher: { helpFirst: 'hint', lead: null },
    });
});

test('Hapus memori belajar deletes the adaptations of the student and the pair on their attempts, keeps practice, and a job claimed before it writes nothing', async (t) => {
    const app = await testApp(t);
    const { classId, assignmentId, teacherToken } = await demoClass(app);
    const student = await demoStudent(app, classId);
    const other = await demoStudent(app, classId, 'Budi');
    const newest = await keptSummary(app, {
        studentId: student.id,
        classId,
        text: 'Catatan kemarin.',
        writtenAt: daysAgo(1),
    });

    await keptSummary(app, {
        studentId: student.id,
        classId,
        text: 'Catatan dua hari lalu.',
        writtenAt: daysAgo(2),
    });

    await app.db.insert(learnerAdaptations).values([
        {
            studentId: student.id,
            classId,
            subject: 'mathematics',
            source: 'teacher',
            helpFirst: 'example',
            lead: 'visual',
        },
        {
            studentId: student.id,
            classId,
            subject: 'indonesian_language',
            aiHelpFirst: 'hint',
            suggestedAt: new Date(),
        },
        { studentId: other.id, classId, subject: 'mathematics', off: true },
    ]);

    const started = await asStudent(
        app,
        student.token,
        'POST',
        `/assignments/${assignmentId}/attempt`,
    );
    const attempt: Started = started.json();

    assert.deepEqual(attempt.adaptation, {
        helpFirst: 'example',
        lead: 'visual',
    });

    const { checks } = await checkIds(app, student.token, assignmentId);

    await app.db.insert(reviewTries).values({
        studentId: student.id,
        blockId: checks[0] ?? 0,
        tryNumber: 1,
        answer: { kind: 'check', choice: 'a' },
        outcome: 'not_yet',
    });

    const claimed = await claimFor(app, {
        studentId: student.id,
        classId,
        attemptId: newest.attemptId,
    });
    const admin = await createUser(app, 'admin');
    const adminToken = await loginAs(app, admin.username);
    const forget = (token: string) =>
        app.inject({
            method: 'DELETE',
            url: `/api/admin/students/${student.id}/memory`,
            headers: { origin: TEST_ORIGIN },
            cookies: { session: token },
        });

    assert.equal((await forget(teacherToken)).statusCode, 403);
    assert.equal(
        (await rowsOf(app, student.id)).length,
        2,
        'a refused call deletes nothing',
    );
    assert.equal((await forget(adminToken)).statusCode, 204);
    assert.deepEqual(await rowsOf(app, student.id), []);
    assert.deepEqual(await attemptRow(app, attempt.id), {
        adaptation: null,
        readAloud: false,
    });
    assert.equal(
        (
            await app.db
                .select({ id: reviewTries.id })
                .from(reviewTries)
                .where(eq(reviewTries.studentId, student.id))
        ).length,
        1,
        'practice stays',
    );
    assert.equal((await rowsOf(app, other.id)).length, 1);

    const provider = await stubProvider(t, [suggestion()]);

    await processAdaptation(app, claimed, provider.config, null);
    assert.equal(provider.requests.length, 0);
    assert.deepEqual(await rowsOf(app, student.id), []);
});
