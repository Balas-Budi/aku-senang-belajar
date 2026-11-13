import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { focusHeading } from '../studio/studio-labels';
import { ChallengeError } from './challenge-error';
import { answeredLine, ChallengeResult } from './challenge-result';
import { OptionList, StartForm } from './challenge-start-form';
import {
    challengeConflict,
    classChallengeQuery,
    useChallengeAction,
    useStartChallenge,
    type ChallengeStart,
    type TeacherChallenge,
} from './queries';

const busy = 'aria-disabled:opacity-60';

function OpenChallenge({
    challenge,
    stale,
    pending,
    onReveal,
    onClose,
}: {
    challenge: TeacherChallenge;
    stale: boolean;
    pending: boolean;
    onReveal: () => void;
    onClose: () => void;
}) {
    return (
        <>
            <div className="space-y-1">
                <p className="font-semibold">
                    Sedang berjalan ·{' '}
                    {challenge.mode === 'group' ? 'Kelompok' : 'Sendiri'}
                </p>
                <p className="text-lg leading-relaxed font-semibold break-words">
                    {challenge.prompt}
                </p>
                <div className="@container pt-2">
                    <OptionList
                        labels={challenge.options.map(({ label }) => label)}
                    />
                </div>
            </div>
            <p role="status" className="text-lg font-semibold tabular-nums">
                {answeredLine(challenge)}
            </p>
            {stale && (
                <Alert tone="attention">
                    Keadaan terbaru belum bisa dimuat. Halaman ini mencoba lagi
                    sendiri.
                </Alert>
            )}
            {challenge.groups.length > 0 && (
                <section aria-labelledby="challenge-groups-list-title">
                    <h3
                        id="challenge-groups-list-title"
                        className="py-1 font-semibold"
                    >
                        Kelompok
                    </h3>
                    <ul className="divide-paper-edge divide-y">
                        {challenge.groups.map((group) => (
                            <li key={group.id} className="py-2 break-words">
                                <span className="font-medium">
                                    {group.name}:
                                </span>{' '}
                                {group.members.join(', ')}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <div className="flex flex-wrap gap-3">
                <Button
                    aria-disabled={pending}
                    className={busy}
                    onClick={onReveal}
                >
                    {pending ? 'Menampilkan…' : 'Tampilkan hasil'}
                </Button>
                <Button variant="outline" onClick={onClose}>
                    Tutup tantangan
                </Button>
            </div>
        </>
    );
}

export function ChallengeCard({ classId }: { classId: number }) {
    const query = useQuery(classChallengeQuery(classId));
    const start = useStartChallenge(classId);
    const action = useChallengeAction(classId);
    const [closing, setClosing] = useState(false);
    const [message, setMessage] = useState({ text: '', count: 0 });
    const heading = useRef<HTMLHeadingElement>(null);
    const closed = useRef(false);
    const announce = useCallback(
        (text: string) =>
            setMessage((previous) => ({ text, count: previous.count + 1 })),
        [],
    );
    const challenge = query.data?.challenge;
    const conflict = [start.error, action.error].find(challengeConflict);
    const refocus = (error: unknown) => {
        if (challengeConflict(error)) heading.current?.focus();
    };

    const begin = (input: ChallengeStart) => {
        if (start.isPending) return;
        action.reset();
        start.mutate(input, {
            onSuccess: () => {
                announce('Tantangan dimulai.');
                heading.current?.focus();
            },
            onError: refocus,
        });
    };
    const reveal = () => {
        if (action.isPending) return;
        start.reset();
        action.mutate(
            { action: 'reveal' },
            {
                onSuccess: () => {
                    announce('Hasil ditampilkan ke siswa.');
                    heading.current?.focus();
                },
                onError: refocus,
            },
        );
    };
    const leaveDialog = () => {
        closed.current = true;
        setClosing(false);
    };
    const close = () => {
        if (action.isPending) return;
        action.mutate(
            { action: 'close' },
            {
                onSuccess: () => {
                    announce('Tantangan ditutup.');
                    leaveDialog();
                },
                onError: (error) => {
                    if (challengeConflict(error)) leaveDialog();
                },
            },
        );
    };
    const closeDialog = (dialog?: HTMLDialogElement) => {
        if (action.isPending) {
            if (dialog && !dialog.open) dialog.showModal();
            return;
        }
        setClosing(false);
        if (closed.current) {
            closed.current = false;
            heading.current?.focus();
        }
    };
    const askClose = () => {
        if (action.isPending) return;
        action.reset();
        start.reset();
        setClosing(true);
    };
    const form = (
        <StartForm
            classId={classId}
            error={start.error}
            pending={start.isPending}
            onStart={begin}
        />
    );

    return (
        <Card>
            <section aria-labelledby="challenge-title" className="space-y-4">
                <div className="space-y-2">
                    <h2
                        id="challenge-title"
                        ref={heading}
                        tabIndex={-1}
                        className={`font-display text-primary-deep text-xl font-semibold sm:text-2xl ${focusHeading}`}
                    >
                        Tantangan kelas
                    </h2>
                    <p className="text-muted-foreground text-base">
                        Satu pertanyaan yang dijawab seluruh kelas pada waktu
                        yang sama, untuk bahan diskusi. Tanpa nilai dan tanpa
                        batas waktu.
                    </p>
                </div>
                {conflict ? (
                    <ChallengeError error={conflict} />
                ) : (
                    !closing && <RequestError error={action.error} />
                )}
                {query.data ? (
                    !challenge ? (
                        form
                    ) : challenge.state === 'open' ? (
                        <OpenChallenge
                            challenge={challenge}
                            stale={query.isError}
                            pending={action.isPending}
                            onReveal={reveal}
                            onClose={askClose}
                        />
                    ) : (
                        <>
                            <ChallengeResult
                                key={challenge.id}
                                classId={classId}
                                challenge={challenge}
                                announce={announce}
                                onClose={askClose}
                            />
                            {challenge.state === 'closed' && (
                                <section
                                    aria-labelledby="challenge-new-title"
                                    className="border-paper-edge space-y-4 border-t pt-4"
                                >
                                    <h3
                                        id="challenge-new-title"
                                        className="font-semibold"
                                    >
                                        Tantangan baru
                                    </h3>
                                    {form}
                                </section>
                            )}
                        </>
                    )
                ) : query.isPending ? (
                    <p role="status">Memuat tantangan kelas…</p>
                ) : (
                    <div className="space-y-3">
                        <RequestError error={query.error} />
                        <Button
                            onClick={() => {
                                void query.refetch();
                            }}
                        >
                            Muat ulang tantangan kelas
                        </Button>
                    </div>
                )}
            </section>
            <p role="status" className="sr-only">
                <span key={message.count}>{message.text}</span>
            </p>
            <Dialog
                open={closing}
                onClose={closeDialog}
                onCancel={(event) => {
                    if (action.isPending) event.preventDefault();
                }}
                aria-labelledby="challenge-close-title"
                aria-describedby="challenge-close-note"
            >
                <h2
                    id="challenge-close-title"
                    className="text-primary-deep text-xl font-bold"
                >
                    Tutup tantangan?
                </h2>
                <p
                    id="challenge-close-note"
                    className="text-muted-foreground mt-2 leading-relaxed"
                >
                    Tantangan ini hilang dari layar siswa. Hasilnya tetap bisa
                    Anda baca di kartu ini.
                </p>
                <div className="mt-5 space-y-4">
                    {closing && !conflict && (
                        <RequestError error={action.error} />
                    )}
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="outline"
                            autoFocus
                            disabled={action.isPending}
                            onClick={() => closeDialog()}
                        >
                            Batal
                        </Button>
                        <Button
                            aria-disabled={action.isPending}
                            className={busy}
                            onClick={close}
                        >
                            {action.isPending ? 'Menutup…' : 'Tutup tantangan'}
                        </Button>
                    </div>
                </div>
            </Dialog>
        </Card>
    );
}
