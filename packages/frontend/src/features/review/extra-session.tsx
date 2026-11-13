import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { StudentNavLink } from '../../components/student-nav-link';
import { RequestError } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import type { Subject } from '../assignments/queries';
import { subjects } from '../assignments/subject-art';
import {
    ReactingJalak,
    ScreenCard,
    ScreenHeading,
} from '../learning-sessions/session-ui';
import { type ReviewQuestion, studentExtraQuery, useExtraTry } from './queries';
import { Question } from './review-session';

function ExtraRun({
    subject,
    started,
    onMissing,
}: {
    subject: Subject;
    started: ReviewQuestion | null;
    onMissing: () => void;
}) {
    const [extra] = useState(started);
    const [done, setDone] = useState(false);
    const client = useQueryClient();
    const send = useExtraTry();
    const back = (
        <Link
            to={`/student/subjects/${subject}`}
            className={buttonVariants({ feel: 'chunky' })}
        >
            Kembali ke {subjects[subject].label}
        </Link>
    );

    if (!extra)
        return (
            <ScreenCard aria-labelledby="extra-empty">
                <ScreenHeading id="extra-empty">
                    Belum ada tantangan tambahan
                </ScreenHeading>
                <p className="text-lg leading-relaxed">
                    Tantangan tambahan muncul di sini setelah kamu menguasai
                    semua yang dipelajari di sebuah misi.
                </p>
                {back}
            </ScreenCard>
        );

    if (done)
        return (
            <ScreenCard aria-labelledby="extra-done">
                <div className="flex flex-col items-center gap-3 text-center">
                    <ReactingJalak cheers={1} chirps={0} className="w-24" />
                    <ScreenHeading id="extra-done" className="text-[2em]">
                        Tantangannya selesai!
                    </ScreenHeading>
                    <p className="text-lg leading-relaxed">
                        Kamu sudah mencoba soal tambahan dari misi{' '}
                        {extra.mission}.
                    </p>
                    {back}
                </div>
            </ScreenCard>
        );

    return (
        <Question
            question={extra}
            heading="Tantangan tambahan!"
            label={`Tantangan tambahan · ${extra.mission}`}
            nextLabel="Selesai"
            send={send}
            onMissing={onMissing}
            narrationId={`extra-${extra.id}`}
            onNext={() => {
                void client.invalidateQueries({
                    queryKey: ['student', 'extra', subject],
                });
                setDone(true);
            }}
        />
    );
}

export function ExtraSession({ subject }: { subject: Subject }) {
    const query = useQuery({
        ...studentExtraQuery(subject),
        staleTime: Infinity,
    });
    const client = useQueryClient();
    const [round, setRound] = useState(0);
    return (
        <div className="space-y-6">
            <StudentNavLink back to={`/student/subjects/${subject}`}>
                Kembali ke {subjects[subject].label}
            </StudentNavLink>
            {query.isPending ? (
                <p role="status" className="text-muted-foreground">
                    Sebentar, kita siapkan tantangannya…
                </p>
            ) : query.data === undefined ? (
                <div className="space-y-3">
                    <RequestError error={query.error} />
                    <Button
                        feel="chunky"
                        onClick={() => {
                            void query.refetch();
                        }}
                    >
                        Muat ulang tantangan
                    </Button>
                </div>
            ) : (
                <ExtraRun
                    key={round}
                    subject={subject}
                    started={query.data.extra}
                    onMissing={() => {
                        void client
                            .refetchQueries({
                                queryKey: ['student', 'extra', subject],
                            })
                            .then(() => setRound((count) => count + 1));
                    }}
                />
            )}
        </div>
    );
}
