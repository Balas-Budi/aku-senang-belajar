import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { StudentNavLink } from '../../components/student-nav-link';
import {
    RequestError,
    requestErrorMessage,
} from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { useErrorToast } from '../../components/ui/toast';
import type { Subject } from '../assignments/queries';
import { SubjectName } from '../assignments/subject-art';
import {
    answerLabels,
    answerMissing,
    CheckAnswer,
    inPlaceNote,
} from '../learning-sessions/activity-input';
import { Feedback, HelpCard } from '../learning-sessions/check-block';
import { DiagramPicture } from '../learning-sessions/diagram';
import { Illustration } from '../learning-sessions/illustration';
import {
    NarrationControls,
    optionBeingRead,
    Spoken,
    useNarration,
} from '../narration/narration';
import {
    ReactingJalak,
    ReasonField,
    ScreenCard,
    ScreenHeading,
} from '../learning-sessions/session-ui';
import { ApiError } from '../../lib/api';
import {
    type PracticeSend,
    type ReviewQuestion,
    studentReviewQuery,
    useReviewTry,
} from './queries';

const HINTS = 3;

export function Question({
    question,
    heading,
    label,
    nextLabel,
    send,
    onMissing,
    narrationId,
    onNext,
}: {
    question: ReviewQuestion;
    heading: string;
    label: string;
    nextLabel: string;
    send: PracticeSend;
    onMissing?: () => void;
    narrationId: string;
    onNext: () => void;
}) {
    const { content } = question;
    const [choice, setChoice] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [earned, setEarned] = useState(question.earned);
    const [tries, setTries] = useState(question.tries);
    const [reactions, setReactions] = useState({ cheers: 0, chirps: 0 });
    const [inPlace, setInPlace] = useState<number | null>(null);
    const showError = useErrorToast();
    const closed = earned.praise !== null || earned.reveal !== null;
    const reasonMissing = Boolean(content.reason) && !reason.trim();
    const narration = useNarration(
        narrationId,
        [content.prompt, ...answerLabels(content)],
        true,
    );

    function check() {
        if (!choice || reasonMissing || send.isPending) return;
        send.mutate(
            {
                blockId: question.id,
                tryNumber: tries + 1,
                answer: {
                    kind: 'check',
                    choice,
                    ...(content.reason ? { reason: reason.trim() } : {}),
                },
            },
            {
                onSuccess: (feedback) => {
                    setTries((count) => count + 1);
                    if (feedback.earned) setEarned(feedback.earned);
                    setInPlace(feedback.inPlace);
                    setReactions((current) =>
                        feedback.outcome === 'correct'
                            ? { ...current, cheers: current.cheers + 1 }
                            : { ...current, chirps: current.chirps + 1 },
                    );
                },
                onError: (error) => {
                    if (
                        onMissing &&
                        error instanceof ApiError &&
                        error.status === 404
                    ) {
                        onMissing();
                        return;
                    }
                    showError(requestErrorMessage(error));
                },
            },
        );
    }

    return (
        <ScreenCard aria-labelledby={narrationId}>
            <p className="text-muted-foreground">{label}</p>
            <ScreenHeading
                id={narrationId}
                className="text-primary text-[1.1em]"
            >
                {heading}
            </ScreenHeading>
            <NarrationControls narration={narration} />
            {content.illustration && (
                <Illustration
                    name={content.illustration}
                    className="mx-auto max-w-sm"
                />
            )}
            {content.diagram && (
                <DiagramPicture
                    diagram={content.diagram}
                    className="mx-auto max-w-sm"
                />
            )}
            <p className="font-display text-primary-deep text-[1.35em] leading-snug font-medium text-pretty">
                <Spoken
                    text={content.prompt}
                    sentence={narration.sentenceIn(0)}
                />
            </p>
            <CheckAnswer
                name={`${narrationId}-choice`}
                content={content}
                earned={earned}
                choice={choice}
                onChange={setChoice}
                reading={optionBeingRead(narration, content.options ?? [], 1)}
            />
            {content.reason && !closed && (
                <ReasonField
                    id={`${narrationId}-reason`}
                    label={content.reason.prompt}
                    starters={content.reason.starters}
                    value={reason}
                    onChange={setReason}
                />
            )}
            {(tries > 0 || closed) && (
                <Feedback
                    earned={earned}
                    {...reactions}
                    note={closed ? undefined : inPlaceNote(content, inPlace)}
                />
            )}
            {earned.hints.map((hint, index) => (
                <HelpCard
                    key={hint.text}
                    title={`Petunjuk ${index + 1} dari ${HINTS}`}
                    picture={hint}
                />
            ))}
            {closed ? (
                <Button
                    feel="chunky"
                    className="w-full sm:w-auto"
                    autoFocus
                    onClick={onNext}
                >
                    {nextLabel}
                </Button>
            ) : (
                <div className="space-y-2">
                    <Button
                        feel="chunky"
                        disabled={!choice || reasonMissing}
                        aria-disabled={send.isPending}
                        className="w-full aria-disabled:opacity-60 sm:w-auto"
                        onClick={check}
                    >
                        {tries ? 'Periksa lagi' : 'Periksa'}
                    </Button>
                    {(!choice || reasonMissing) && (
                        <p className="text-muted-foreground">
                            {!choice
                                ? answerMissing(content)
                                : 'Tulis alasanmu dulu, ya.'}
                        </p>
                    )}
                </div>
            )}
        </ScreenCard>
    );
}

function ReviewRun({
    subject,
    started,
}: {
    subject: Subject;
    started: ReviewQuestion[];
}) {
    const [questions] = useState(started);
    const [index, setIndex] = useState(0);
    const client = useQueryClient();
    const send = useReviewTry();
    const back = (
        <Link
            to={`/student/subjects/${subject}`}
            className={buttonVariants({ feel: 'chunky' })}
        >
            Kembali ke <SubjectName subject={subject} />
        </Link>
    );
    const question = questions[index];

    if (questions.length === 0)
        return (
            <ScreenCard aria-labelledby="review-empty">
                <ScreenHeading id="review-empty">
                    Belum ada latihan
                </ScreenHeading>
                <p className="text-lg leading-relaxed">
                    Ulang Yuk muncul setelah gurumu melihat hasil misimu.
                </p>
                {back}
            </ScreenCard>
        );

    if (!question)
        return (
            <ScreenCard aria-labelledby="review-done">
                <div className="flex flex-col items-center gap-3 text-center">
                    <ReactingJalak cheers={1} chirps={0} className="w-24" />
                    <ScreenHeading id="review-done" className="text-[2em]">
                        Ulang Yuk selesai!
                    </ScreenHeading>
                    <p className="text-lg leading-relaxed">
                        Kamu sudah berlatih {questions.length} soal. Hebat!
                    </p>
                    {back}
                </div>
            </ScreenCard>
        );

    return (
        <Question
            key={question.id}
            question={question}
            heading="Ulang Yuk!"
            label={`Soal ${index + 1} dari ${questions.length} · ${question.mission}`}
            nextLabel={
                index + 1 < questions.length ? 'Soal berikutnya' : 'Selesai'
            }
            send={send}
            narrationId={`review-${question.id}`}
            onNext={() => {
                if (index + 1 === questions.length)
                    void client.invalidateQueries({
                        queryKey: ['student', 'review', subject],
                    });
                setIndex(index + 1);
            }}
        />
    );
}

export function ReviewSession({ subject }: { subject: Subject }) {
    const query = useQuery({
        ...studentReviewQuery(subject),
        staleTime: Infinity,
    });
    return (
        <div className="space-y-6">
            <StudentNavLink back to={`/student/subjects/${subject}`}>
                Kembali ke <SubjectName subject={subject} />
            </StudentNavLink>
            {query.isPending ? (
                <p role="status" className="text-muted-foreground">
                    Sebentar, kita siapkan soalnya…
                </p>
            ) : query.isError ? (
                <div className="space-y-3">
                    <RequestError error={query.error} />
                    <Button
                        feel="chunky"
                        onClick={() => {
                            void query.refetch();
                        }}
                    >
                        Muat ulang soal
                    </Button>
                </div>
            ) : (
                <ReviewRun subject={subject} started={query.data.questions} />
            )}
        </div>
    );
}
