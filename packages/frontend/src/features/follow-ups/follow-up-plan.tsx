import { useQuery } from '@tanstack/react-query';
import { type ReactNode, type RefObject, useRef, useState } from 'react';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { classesQuery } from '../classes/queries';
import { StatusChip } from '../results/status';
import { focusHeading } from '../studio/studio-labels';
import { kindLabels, practised } from './follow-up-dialog';
import {
    classFollowUpsQuery,
    type FollowUp,
    type Practice,
    useMarkFollowUp,
} from './queries';
import { BackLink } from '../../components/back-link';

const day = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });
const busy = 'aria-disabled:opacity-60';

function practiceText({ done, total, right }: Practice) {
    if (done === 0) return 'Belum mulai';
    if (done < total) return `${done} dari ${total} soal`;
    return `Selesai, ${right} benar`;
}

function FollowUpItem({
    followUp,
    pending,
    error,
    onMark,
}: {
    followUp: FollowUp;
    pending: boolean;
    error: unknown;
    onMark: () => void;
}) {
    const { competency } = followUp;
    const name = `${kindLabels[followUp.kind]} · ${followUp.mission}`;

    return (
        <li className="space-y-3 py-4">
            <div className="space-y-1">
                <h3 className="font-semibold break-words">{name}</h3>
                {competency && (
                    <p className="break-words">
                        <span className="font-semibold">{competency.code}</span>{' '}
                        {competency.description}
                    </p>
                )}
                <p className="text-muted-foreground text-sm">
                    Dibuat {day.format(new Date(followUp.createdAt))}
                </p>
                {followUp.note && (
                    <p className="break-words">
                        <span className="text-muted-foreground">
                            {practised(followUp.kind)
                                ? 'Pesan untuk siswa:'
                                : 'Catatan:'}
                        </span>{' '}
                        {followUp.note}
                    </p>
                )}
            </div>
            <ul className="border-paper-edge divide-paper-edge divide-y rounded-lg border">
                {followUp.students.map((student) => (
                    <li
                        key={student.id}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2"
                    >
                        <span className="min-w-0 font-medium break-words">
                            {student.name}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {competency &&
                                (student.status ? (
                                    <StatusChip status={student.status} />
                                ) : (
                                    <span className="text-muted-foreground text-sm">
                                        Belum ada status
                                    </span>
                                ))}
                            {student.practice && (
                                <span className="text-sm tabular-nums">
                                    <span className="text-muted-foreground">
                                        Latihan:
                                    </span>{' '}
                                    {practiceText(student.practice)}
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
            <Button
                variant="outline"
                aria-disabled={pending}
                className={busy}
                onClick={onMark}
            >
                {pending
                    ? 'Menyimpan…'
                    : followUp.doneAt === null
                      ? 'Tandai selesai'
                      : 'Buka lagi'}
                <span className="sr-only">
                    {' '}
                    {name}
                    {competency ? ` ${competency.code}` : ''}
                </span>
            </Button>
            <RequestError error={error} />
        </li>
    );
}

function PlanSection({
    id,
    title,
    heading,
    followUps,
    empty,
    renderItem,
}: {
    id: string;
    title: string;
    heading: RefObject<HTMLHeadingElement | null>;
    followUps: FollowUp[];
    empty: string;
    renderItem: (followUp: FollowUp) => ReactNode;
}) {
    return (
        <Card>
            <section aria-labelledby={id}>
                <h2
                    id={id}
                    ref={heading}
                    tabIndex={-1}
                    className={`font-display text-primary-deep text-xl font-semibold sm:text-2xl ${focusHeading}`}
                >
                    {title}{' '}
                    <span className="text-muted-foreground ml-1 text-sm font-normal tabular-nums">
                        {followUps.length}
                    </span>
                </h2>
                {followUps.length === 0 ? (
                    <p className="mt-2">{empty}</p>
                ) : (
                    <ul className="divide-paper-edge divide-y">
                        {followUps.map(renderItem)}
                    </ul>
                )}
            </section>
        </Card>
    );
}

export function FollowUpsLink({ classId }: { classId: number }) {
    const open = useQuery(classFollowUpsQuery(classId)).data?.followUps.filter(
        ({ doneAt }) => doneAt === null,
    ).length;

    return (
        <Link
            to={`/teacher/classes/${classId}/follow-ups`}
            className={buttonVariants({
                variant: 'outline',
                className: 'min-h-11 bg-white px-4',
            })}
        >
            {open === undefined
                ? 'Rencana tindak lanjut'
                : `Rencana tindak lanjut · ${open} terbuka`}
        </Link>
    );
}

export function FollowUpPlan({ classId }: { classId: number }) {
    const query = useQuery(classFollowUpsQuery(classId));
    const classes = useQuery(classesQuery());
    const mark = useMarkFollowUp(classId);
    const [message, setMessage] = useState({ text: '', count: 0 });
    const openHeading = useRef<HTMLHeadingElement>(null);
    const doneHeading = useRef<HTMLHeadingElement>(null);
    const className = classes.data?.find(({ id }) => id === classId)?.name;
    const back = (
        <BackLink to={`/teacher/classes/${classId}`}>
            Kembali ke {className ?? 'kelas'}
        </BackLink>
    );

    if (!query.data)
        return (
            <>
                {back}
                {query.isPending ? (
                    <p role="status">Memuat rencana tindak lanjut…</p>
                ) : (
                    <div className="space-y-3">
                        <RequestError error={query.error} />
                        <Button
                            onClick={() => {
                                void query.refetch();
                            }}
                        >
                            Muat ulang rencana
                        </Button>
                    </div>
                )}
            </>
        );

    const toggle = (followUp: FollowUp) => {
        if (mark.isPending) return;
        const done = followUp.doneAt === null;
        mark.mutate(
            { id: followUp.id, done },
            {
                onSuccess: () => {
                    setMessage((previous) => ({
                        text: done
                            ? 'Tindak lanjut dipindah ke Selesai.'
                            : 'Tindak lanjut dipindah ke Terbuka.',
                        count: previous.count + 1,
                    }));
                    (done ? doneHeading : openHeading).current?.focus();
                },
            },
        );
    };
    const renderItem = (followUp: FollowUp) => {
        const marking = mark.variables?.id === followUp.id;
        return (
            <FollowUpItem
                key={followUp.id}
                followUp={followUp}
                pending={marking && mark.isPending}
                error={marking ? mark.error : null}
                onMark={() => toggle(followUp)}
            />
        );
    };
    const { followUps } = query.data;

    return (
        <div className="space-y-6">
            {back}
            <Card className="space-y-2 print:border-0 print:p-0 print:shadow-none">
                <h1 className="font-display text-primary-deep text-3xl leading-tight font-semibold break-words sm:text-4xl">
                    Rencana tindak lanjut
                </h1>
                <p className="text-muted-foreground">
                    Penguatan dan Pengayaan muncul di jalur siswa sebagai kartu
                    Dari gurumu. Diskusi kelas dan Ajar ulang hanya untuk Anda.
                </p>
            </Card>
            <PlanSection
                id="follow-ups-open"
                title="Terbuka"
                heading={openHeading}
                followUps={followUps.filter(({ doneAt }) => doneAt === null)}
                empty="Belum ada tindak lanjut yang terbuka. Buat dari hasil misi dengan tombol Tindak lanjut di setiap kompetensi."
                renderItem={renderItem}
            />
            <PlanSection
                id="follow-ups-done"
                title="Selesai"
                heading={doneHeading}
                followUps={followUps.filter(({ doneAt }) => doneAt !== null)}
                empty="Belum ada tindak lanjut yang selesai."
                renderItem={renderItem}
            />
            <p role="status" className="sr-only">
                <span key={message.count}>{message.text}</span>
            </p>
        </div>
    );
}
