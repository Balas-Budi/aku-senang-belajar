import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { StudentNavLink } from '../../components/student-nav-link';
import { RequestError } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { ApiError } from '../../lib/api';
import type { Subject } from '../assignments/queries';
import { SubjectName } from '../assignments/subject-art';
import {
    ReactingJalak,
    ScreenCard,
    ScreenHeading,
} from '../learning-sessions/session-ui';
import type { ReviewQuestion } from '../review/queries';
import { Question } from '../review/review-session';
import { studentFollowUpQuery, useFollowUpTry } from './queries';

export function FollowUpGone({ failed = false }: { failed?: boolean }) {
    return (
        <ScreenCard aria-labelledby="follow-up-gone">
            <ScreenHeading id="follow-up-gone">Dari gurumu</ScreenHeading>
            <p className="text-lg leading-relaxed">
                {failed
                    ? 'Latihan ini belum bisa dibuka. Coba lagi sebentar lagi.'
                    : 'Latihan ini sudah selesai atau ditutup gurumu.'}
            </p>
            <Link to="/student" className={buttonVariants({ feel: 'chunky' })}>
                Kembali ke beranda
            </Link>
        </ScreenCard>
    );
}

function FollowUpRun({
    followUpId,
    subject,
    started,
}: {
    followUpId: number;
    subject: Subject;
    started: ReviewQuestion[];
}) {
    const [questions] = useState(started);
    const [index, setIndex] = useState(0);
    const [gone, setGone] = useState(false);
    const client = useQueryClient();
    const send = useFollowUpTry(followUpId);
    const refresh = () =>
        client.invalidateQueries({ queryKey: ['student', 'follow-ups'] });
    const question = questions[index];

    if (gone || questions.length === 0) return <FollowUpGone />;

    if (!question)
        return (
            <ScreenCard aria-labelledby="follow-up-done">
                <div className="flex flex-col items-center gap-3 text-center">
                    <ReactingJalak cheers={1} chirps={0} className="w-24" />
                    <ScreenHeading id="follow-up-done" className="text-[2em]">
                        Latihan dari gurumu selesai!
                    </ScreenHeading>
                    <p className="text-lg leading-relaxed">
                        Kamu sudah berlatih {questions.length} soal. Hebat!
                    </p>
                    <Link
                        to={`/student/subjects/${subject}`}
                        className={buttonVariants({ feel: 'chunky' })}
                    >
                        Kembali ke <SubjectName subject={subject} />
                    </Link>
                </div>
            </ScreenCard>
        );

    return (
        <Question
            key={question.id}
            question={question}
            heading="Dari gurumu"
            label={`Soal ${index + 1} dari ${questions.length} · ${question.mission}`}
            nextLabel={
                index + 1 < questions.length ? 'Soal berikutnya' : 'Selesai'
            }
            send={send}
            onMissing={() => {
                void refresh();
                setGone(true);
            }}
            narrationId={`follow-up-${question.id}`}
            onNext={() => {
                if (index + 1 === questions.length) void refresh();
                setIndex(index + 1);
            }}
        />
    );
}

export function FollowUpSession({ followUpId }: { followUpId: number }) {
    const query = useQuery({
        ...studentFollowUpQuery(followUpId),
        staleTime: Infinity,
    });
    const subject = query.data?.followUp.subject;

    return (
        <div className="space-y-6">
            {subject ? (
                <StudentNavLink back to={`/student/subjects/${subject}`}>
                    Kembali ke <SubjectName subject={subject} />
                </StudentNavLink>
            ) : (
                <StudentNavLink back to="/student">
                    Kembali ke beranda
                </StudentNavLink>
            )}
            {query.data ? (
                <FollowUpRun
                    key={followUpId}
                    followUpId={followUpId}
                    subject={query.data.followUp.subject}
                    started={query.data.questions}
                />
            ) : query.isPending ? (
                <p role="status" className="text-muted-foreground">
                    Sebentar, kita siapkan soalnya…
                </p>
            ) : query.error instanceof ApiError &&
              query.error.status === 404 ? (
                <FollowUpGone />
            ) : (
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
            )}
        </div>
    );
}
