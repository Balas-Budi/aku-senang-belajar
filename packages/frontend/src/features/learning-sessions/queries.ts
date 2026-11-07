import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import type { Subject } from '../assignments/queries';
import type { IllustrationName } from './illustration';

export type Step = 'opening' | 'story' | 'challenge' | 'reflection';
export type Option = {
    id: string;
    label: string;
    illustration?: IllustrationName;
};
export type Picture = { text: string; illustration?: IllustrationName };
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
              options: Option[];
          };
      }
    | {
          kind: 'story';
          content: {
              text: string;
              illustration?: IllustrationName;
              fraction?: Fraction;
          };
      }
    | {
          kind: 'check';
          content: {
              prompt: string;
              illustration?: IllustrationName;
              options: Option[];
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
export type Attempt = {
    id: number;
    status: 'in_progress' | 'submitted';
    checkpoint: number;
    answers: SavedAnswer[];
    done: Done | null;
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
export type Feedback = { outcome: Outcome; earned: Earned | null };

export const sessionQuery = (assignmentId: number, cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'sessions', assignmentId],
        queryFn: () =>
            api<LearningSession>(`/api/student/assignments/${assignmentId}`, {
                headers: cookie ? { cookie } : undefined,
            }),
    });

export function answersFor(attempt: Attempt, blockId: number) {
    return attempt.answers.filter((saved) => saved.blockId === blockId);
}

const listKey = ['student', 'path'];

function useSession(assignmentId: number) {
    const client = useQueryClient();
    const key = sessionQuery(assignmentId).queryKey;

    return {
        update: (change: (session: LearningSession) => LearningSession) =>
            client.setQueryData(key, (session) => session && change(session)),
        resync: (error: Error) => {
            if (error instanceof ApiError && error.status === 409)
                void client.invalidateQueries({ queryKey: key });
        },
        refreshList: () => client.invalidateQueries({ queryKey: listKey }),
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
        onSuccess: (attempt) => {
            session.update((current) => ({ ...current, attempt }));
            void session.refreshList();
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
        onMutate: ({ blockId }) =>
            session.update((current) =>
                current.attempt
                    ? {
                          ...current,
                          attempt: { ...current.attempt, checkpoint: blockId },
                      }
                    : current,
            ),
        onError: session.resync,
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
            kind: 'hint' | 'example' | 'ask_teacher';
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
