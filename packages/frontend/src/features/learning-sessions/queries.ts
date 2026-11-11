import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import type { Subject } from '../assignments/queries';
import type { Diagram } from './diagram';
import type { IllustrationName } from './illustration';

export type Step = 'opening' | 'story' | 'challenge' | 'reflection';
export type Option = {
    id: string;
    label: string;
    illustration?: IllustrationName;
};
export type ActivityItem = { id: string; label: string };
export type Activity =
    | { type: 'order'; cards: ActivityItem[] }
    | { type: 'match'; places: ActivityItem[]; cards: ActivityItem[] }
    | { type: 'group'; places: ActivityItem[]; cards: ActivityItem[] }
    | { type: 'shade'; shape: 'bar' | 'circle'; parts: number };
export type Picture = {
    text: string;
    illustration?: IllustrationName;
    diagram?: Diagram;
};
export type Earned = {
    hints: Picture[];
    example: Picture | null;
    praise: string | null;
    reveal: { answer: string; text: string } | null;
};
type Fraction = {
    numerator: number;
    denominator: number;
    numeratorNote: string;
    denominatorNote: string;
};
export type Block = { id: number; position: number; step: Step } & (
    | { kind: 'brain_game'; content: { game: 'memory_pairs' } }
    | {
          kind: 'hook';
          content: {
              prompt: string;
              illustration?: IllustrationName;
              diagram?: Diagram;
              options: Option[];
          };
      }
    | {
          kind: 'story';
          content: {
              text: string;
              illustration?: IllustrationName;
              diagram?: Diagram;
              fraction?: Fraction;
          };
      }
    | {
          kind: 'check';
          content: {
              prompt: string;
              illustration?: IllustrationName;
              diagram?: Diagram;
              options?: Option[];
              activity?: Activity;
              reason?: { prompt: string; starters: string[] };
          };
          earned: Earned;
      }
    | {
          kind: 'challenge';
          content: {
              prompt: string;
              question: string;
              illustration?: IllustrationName;
              diagram?: Diagram;
              options: Option[];
              reasonStarter: string;
          };
      }
    | { kind: 'reflection'; content: { topics: string[] } }
);
export type BlockOf<Kind extends Block['kind']> = Extract<
    Block,
    { kind: Kind }
>;
export type Answer =
    | { kind: 'hook'; choice: string }
    | { kind: 'check'; choice: string; reason?: string }
    | { kind: 'challenge'; choice: string; reason: string }
    | {
          kind: 'reflection';
          understood: string[];
          confusing: string[];
          note?: string;
      };
export type Outcome = 'accepted' | 'correct' | 'not_yet';
type SavedAnswer = {
    blockId: number;
    tryNumber: number;
    answer: Answer;
    outcome: Outcome;
};
export type Done = { takeaways: string[]; toPractise: string[] };
export type Adaptation = {
    helpFirst: 'hint' | 'example' | null;
    lead: 'text' | 'audio' | 'visual' | null;
};
export type Attempt = {
    id: number;
    status: 'in_progress' | 'submitted';
    checkpoint: number;
    answers: SavedAnswer[];
    done: Done | null;
    adaptation: Adaptation | null;
};
export type LearningSession = {
    id: number;
    title: string;
    summary: string;
    subject: Subject;
    moduleId: number;
    moduleTitle: string;
    blocks: Block[];
    attempt: Attempt | null;
};
export type AnswerInput = {
    attemptId: number;
    blockId: number;
    tryNumber: number;
    answer: Answer;
};
export type Feedback = {
    outcome: Outcome;
    earned: Earned | null;
    inPlace: number | null;
};

export const sessionQuery = (assignmentId: number, cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'sessions', assignmentId],
        queryFn: () =>
            api<LearningSession>(`/api/student/assignments/${assignmentId}`, {
                headers: cookie ? { cookie } : undefined,
            }),
    });

export type LiveSession = {
    mode: 'together' | 'own_pace';
    state: 'open' | 'paused' | 'ended';
    openStep: Step;
    endsAt: string | null;
};

export const studentLiveQuery = (assignmentId: number) =>
    queryOptions({
        queryKey: ['student', 'live', assignmentId],
        queryFn: () =>
            api<{ live: LiveSession | null }>(
                `/api/student/assignments/${assignmentId}/live`,
            ),
        refetchInterval: 5_000,
        retry: false,
        gcTime: 0,
    });

export const liveRefusal = (error: unknown) =>
    error instanceof ApiError &&
    error.status === 409 &&
    (error.body.name === 'LIVE_PAUSED' || error.body.name === 'LIVE_WAIT');

export function answersFor(attempt: Attempt, blockId: number) {
    return attempt.answers.filter((saved) => saved.blockId === blockId);
}

const listKey = ['student', 'path'];

const withCheckpoint = (
    session: LearningSession,
    checkpoint: number,
): LearningSession =>
    session.attempt
        ? { ...session, attempt: { ...session.attempt, checkpoint } }
        : session;

function useSession(assignmentId: number) {
    const client = useQueryClient();
    const key = sessionQuery(assignmentId).queryKey;

    return {
        read: () => client.getQueryData(key),
        update: (change: (session: LearningSession) => LearningSession) =>
            client.setQueryData(key, (session) => session && change(session)),
        refetch: () =>
            client.refetchQueries({ queryKey: key }, { throwOnError: true }),
        resync: (error: Error) => {
            if (liveRefusal(error))
                void client.invalidateQueries({
                    queryKey: studentLiveQuery(assignmentId).queryKey,
                });
            else if (error instanceof ApiError && error.status === 409)
                void client.invalidateQueries({ queryKey: key });
        },
        refreshList: () =>
            Promise.all([
                client.invalidateQueries({ queryKey: listKey }),
                client.invalidateQueries({ queryKey: ['student', 'cards'] }),
            ]),
    };
}

function withEarned(
    session: LearningSession,
    blockId: number,
    earned: Earned | null,
): LearningSession {
    if (!earned) return session;
    return {
        ...session,
        blocks: session.blocks.map((block) =>
            block.id === blockId && block.kind === 'check'
                ? { ...block, earned }
                : block,
        ),
    };
}

export function useStartAttempt(assignmentId: number) {
    const session = useSession(assignmentId);
    return useMutation({
        mutationFn: () =>
            api<Attempt>(`/api/student/assignments/${assignmentId}/attempt`, {
                method: 'POST',
            }),
        onSuccess: async () => {
            void session.refreshList();
            await session.refetch();
        },
    });
}

export function useMoveCheckpoint(assignmentId: number) {
    const session = useSession(assignmentId);
    return useMutation({
        mutationFn: ({
            attemptId,
            blockId,
        }: {
            attemptId: number;
            blockId: number;
        }) =>
            api(`/api/student/attempts/${attemptId}/checkpoint`, {
                method: 'PUT',
                body: JSON.stringify({ blockId }),
            }),
        onMutate: ({ blockId }) => {
            const before = session.read()?.attempt?.checkpoint;
            session.update((current) => withCheckpoint(current, blockId));
            return before;
        },
        onError: (error, _input, before) => {
            if (liveRefusal(error) && before !== undefined)
                session.update((current) => withCheckpoint(current, before));
            session.resync(error);
        },
        onSettled: session.refreshList,
    });
}

export function useAnswer(assignmentId: number) {
    const session = useSession(assignmentId);
    return useMutation({
        mutationFn: ({ attemptId, ...body }: AnswerInput) =>
            api<Feedback>(`/api/student/attempts/${attemptId}/responses`, {
                method: 'POST',
                body: JSON.stringify(body),
            }),
        onSuccess: (feedback, { blockId, tryNumber, answer }) =>
            session.update((current) => {
                const { attempt } = current;
                if (!attempt) return current;
                const known = attempt.answers.some(
                    (saved) =>
                        saved.blockId === blockId &&
                        saved.tryNumber === tryNumber,
                );
                const answers = known
                    ? attempt.answers
                    : [
                          ...attempt.answers,
                          {
                              blockId,
                              tryNumber,
                              answer,
                              outcome: feedback.outcome,
                          },
                      ];
                return withEarned(
                    { ...current, attempt: { ...attempt, answers } },
                    blockId,
                    feedback.earned,
                );
            }),
        onError: session.resync,
    });
}

export function useHelp(assignmentId: number) {
    const session = useSession(assignmentId);
    return useMutation({
        mutationFn: ({
            attemptId,
            blockId,
            kind,
        }: {
            attemptId: number;
            blockId: number;
            kind: 'hint' | 'example' | 'ask_teacher' | 'listen';
        }) =>
            api<{ earned: Earned | null }>(
                `/api/student/attempts/${attemptId}/help`,
                { method: 'POST', body: JSON.stringify({ blockId, kind }) },
            ),
        onSuccess: ({ earned }, { blockId }) =>
            session.update((current) => withEarned(current, blockId, earned)),
        onError: session.resync,
    });
}

export function useSubmit(assignmentId: number) {
    const session = useSession(assignmentId);
    return useMutation({
        mutationFn: (attemptId: number) =>
            api<Done>(`/api/student/attempts/${attemptId}/submit`, {
                method: 'POST',
            }),
        onSuccess: (done) => {
            session.update((current) =>
                current.attempt
                    ? {
                          ...current,
                          attempt: {
                              ...current.attempt,
                              status: 'submitted',
                              done,
                          },
                      }
                    : current,
            );
            void session.refreshList();
        },
    });
}
