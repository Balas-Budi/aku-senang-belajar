import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import {
    RequestError,
    requestErrorMessage,
} from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { textLink } from '../../components/ui/text-link';
import { useErrorToast } from '../../components/ui/toast';
import type { Subject } from '../assignments/queries';
import { subjects } from '../assignments/subject-art';
import { Feedback, HelpCard } from '../learning-sessions/check-block';
import { Illustration } from '../learning-sessions/illustration';
import {
    NarrationControls,
    optionBeingRead,
    Spoken,
    useNarration,
} from '../narration/narration';
import {
    OptionPicker,
    ReactingJalak,
    ReasonField,
    ScreenCard,
    ScreenHeading,
} from '../learning-sessions/session-ui';
import {
    type ReviewQuestion,
    studentReviewQuery,
    useReviewTry,
} from './queries';

const HINTS = 3;

function Question({
    question,
    number,
    total,
    onNext,
}: {
    question: ReviewQuestion;
    number: number;
    total: number;
    onNext: () => void;
}) {
    const { content } = question;
    const [choice, setChoice] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [earned, setEarned] = useState(question.earned);
    const [tries, setTries] = useState(question.tries);
    const [reactions, setReactions] = useState({ cheers: 0, chirps: 0 });
    const send = useReviewTry();
    const showError = useErrorToast();
    const closed = earned.praise !== null || earned.reveal !== null;
    const reasonMissing = Boolean(content.reason) && !reason.trim();
    const narration = useNarration(
        `review-${question.id}`,
        [content.prompt, ...content.options.map(({ label }) => label)],
        true,
    );

    function check() {
        if (!choice || reasonMissing) return;
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
                    setReactions((current) =>
                        feedback.outcome === 'correct'
                            ? { ...current, cheers: current.cheers + 1 }
                            : { ...current, chirps: current.chirps + 1 },
                    );
                },
                onError: (error) => showError(requestErrorMessage(error)),
            },
        );
    }

    return (
        <ScreenCard aria-labelledby={`review-${question.id}`}>
            <p className="text-muted-foreground">
                Soal {number} dari {total} · {question.mission}
            </p>
            <ScreenHeading
                id={`review-${question.id}`}
                className="text-primary text-[1.1em]"
            >
                Ulang Yuk!
            </ScreenHeading>
            <NarrationControls narration={narration} />
            {content.illustration && (
                <Illustration
                    name={content.illustration}
                    className="mx-auto max-w-sm"
                />
            )}
            <p className="font-display text-primary-deep text-[1.35em] leading-snug font-medium text-pretty">
                <Spoken
                    text={content.prompt}
                    sentence={narration.sentenceIn(0)}
                />
            </p>
            <OptionPicker
                name={`review-${question.id}-choice`}
                legend={content.prompt}
                options={content.options}
                value={choice}
                onChange={setChoice}
                disabled={closed}
                correct={
                    earned.reveal?.answer ?? (earned.praise ? choice : null)
                }
                reading={optionBeingRead(narration, content.options, 1)}
            />
            {content.reason && !closed && (
                <ReasonField
                    id={`review-${question.id}-reason`}
                    label={content.reason.prompt}
                    starters={content.reason.starters}
                    value={reason}
                    onChange={setReason}
                />
            )}
            {(tries > 0 || closed) && (
                <Feedback earned={earned} {...reactions} />
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
                    {number < total ? 'Soal berikutnya' : 'Selesai'}
                </Button>
            ) : (
                <div className="space-y-2">
                    <Button
                        feel="chunky"
                        disabled={!choice || reasonMissing || send.isPending}
                        onClick={check}
                    >
                        {tries ? 'Periksa lagi' : 'Periksa'}
                    </Button>
                    {(!choice || reasonMissing) && (
                        <p className="text-muted-foreground">
                            {!choice
                                ? 'Pilih satu jawaban dulu.'
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
    const back = (
        <Link
            to={`/student/subjects/${subject}`}
            className={buttonVariants({ feel: 'chunky' })}
        >
            Kembali ke {subjects[subject].label}
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
            number={index + 1}
            total={questions.length}
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
            <Link to={`/student/subjects/${subject}`} className={textLink}>
                Kembali ke {subjects[subject].label}
            </Link>
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
