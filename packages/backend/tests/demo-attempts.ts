import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AiConfig } from '../src/ai/chat.ts';
import { claimRun, processRun } from '../src/analysis/runner.ts';
import { assignments, classMembers } from '../src/db/schema.ts';
import { demoModule } from '../src/learning/demo-module.ts';
import { seedModule } from '../src/learning/seed-module.ts';
import { completion, type ProviderRequest } from './ai-stub.ts';
import {
    createClass,
    createStudent,
    createUser,
    loginAs,
    TEST_ORIGIN,
    TEST_STUDENT_PASSWORD,
} from './helpers.ts';

const sent = z.object({
    competencies: z.array(
        z.object({
            code: z.string(),
            evidence: z.array(
                z.object({
                    block: z.int(),
                    kind: z.string(),
                    tries: z.array(z.object({ ref: z.int() })),
                }),
            ),
            selfReport: z.object({ ref: z.int() }).nullable(),
        }),
    ),
});

export type Sent = z.infer<typeof sent>['competencies'][number];

type Entry = {
    status: string;
    reason: string;
    uncertainty: string;
    flags: string[];
    evidence: number[];
    followUps: string[];
};

export function sentEvidence(request: ProviderRequest) {
    const message = request.body.messages[1];

    assert.ok(message, 'the request holds the evidence as its second message');

    return sent.parse(JSON.parse(message.content)).competencies;
}

export function refsOf(competency: Sent) {
    return competency.evidence.flatMap(({ tries }) =>
        tries.map(({ ref }) => ref),
    );
}

export function verdicts(
    change: (competency: Sent) => Partial<Entry> = () => ({}),
) {
    return (request: ProviderRequest) => ({
        body: completion(
            JSON.stringify({
                competencies: sentEvidence(request).map((competency) => ({
                    code: competency.code,
                    status: 'visible',
                    reason: 'Jawabannya menunjukkan pemahaman.',
                    uncertainty: 'low',
                    flags: [],
                    evidence: refsOf(competency).slice(-1),
                    followUps: [],
                    ...change(competency),
                })),
            }),
        ),
    });
}

export function asStudent(
    app: FastifyInstance,
    token: string,
    method: 'GET' | 'POST',
    url: string,
    payload?: object,
) {
    return app.inject({
        method,
        url: `/api/student${url}`,
        headers: { origin: TEST_ORIGIN },
        cookies: { session: token },
        payload,
    });
}

export async function demoClass(app: FastifyInstance, extraCompetency = false) {
    const teacher = await createUser(app);
    const teacherToken = await loginAs(app, teacher.username);
    const classroom = await createClass(app, teacherToken);
    const { sessionId } = await seedModule(app.db, classroom.id, {
        ...demoModule,
        material: `Demo module ${randomUUID()}`,
        competencies: extraCompetency
            ? [
                  ...demoModule.competencies,
                  { code: 'C4', description: 'Membandingkan 1/3 dan 1/4.' },
              ]
            : demoModule.competencies,
    });
    const [assignment] = await app.db
        .select({ id: assignments.id })
        .from(assignments)
        .where(
            and(
                eq(assignments.learningSessionId, sessionId),
                eq(assignments.classId, classroom.id),
            ),
        );

    assert.ok(assignment, 'the demo module is assigned to the class');

    return {
        teacher,
        teacherToken,
        classId: classroom.id,
        assignmentId: assignment.id,
    };
}

export async function demoStudent(
    app: FastifyInstance,
    classId: number,
    name = 'Wulan Sari',
) {
    const student = await createStudent(app, name);

    await app.db
        .insert(classMembers)
        .values({ studentId: student.id, classId });

    return {
        ...student,
        token: await loginAs(app, student.username, TEST_STUDENT_PASSWORD),
    };
}

export async function takeDemo(
    app: FastifyInstance,
    token: string,
    assignmentId: number,
) {
    const detail: { blocks: { id: number; kind: string }[] } = (
        await asStudent(app, token, 'GET', `/assignments/${assignmentId}`)
    ).json();
    const attempt: { id: number } = (
        await asStudent(
            app,
            token,
            'POST',
            `/assignments/${assignmentId}/attempt`,
        )
    ).json();
    const blockId = (kind: string, index = 0) => {
        const block = detail.blocks.filter((entry) => entry.kind === kind)[
            index
        ];

        if (!block) {
            throw new Error(`The demo has no ${kind} block ${index + 1}`);
        }

        return block.id;
    };
    const answer = async (id: number, tryNumber: number, given: object) => {
        const response = await asStudent(
            app,
            token,
            'POST',
            `/attempts/${attempt.id}/responses`,
            { blockId: id, tryNumber, answer: given },
        );

        assert.equal(response.statusCode, 201, `block ${id} try ${tryNumber}`);
    };

    await answer(blockId('hook'), 1, { kind: 'hook', choice: 'a' });
    await answer(blockId('check', 0), 1, {
        kind: 'check',
        choice: 'a',
        reason: 'Karena dipotong empat',
    });
    await answer(blockId('check', 0), 2, {
        kind: 'check',
        choice: 'b',
        reason: 'Karena potongannya tidak sama besar',
    });
    await answer(blockId('check', 1), 1, { kind: 'check', choice: 'b' });
    await answer(blockId('challenge'), 1, {
        kind: 'challenge',
        choice: 'b',
        reason: 'Budi, karena setengah lebih besar dari seperempat',
    });
    await answer(blockId('reflection'), 1, {
        kind: 'reflection',
        understood: ['Arti 1/4'],
        confusing: [],
    });

    const submitted = await asStudent(
        app,
        token,
        'POST',
        `/attempts/${attempt.id}/submit`,
    );

    assert.equal(submitted.statusCode, 200);

    return attempt.id;
}

export async function runFor(
    app: FastifyInstance,
    attemptId: number,
    ai: AiConfig | null,
) {
    const run = await claimRun(app.db, { attemptId });

    assert.ok(run, 'the attempt has a due run');
    await processRun(app, run, ai);
}
