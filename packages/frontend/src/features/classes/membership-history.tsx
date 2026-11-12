import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { textLink } from '../../components/ui/text-link';
import {
    classMembershipQuery,
    type MembershipEvent,
    type PastMember,
} from './queries';

const EVENT_LIMIT = 200;

const day = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

const reasons: Record<PastMember['reason'], string> = {
    left: 'Keluar sendiri',
    moved: 'Dipindahkan',
    archived: 'Diarsipkan',
};

function eventSentence({
    action,
    student,
    actor,
    otherClass,
    direction,
}: MembershipEvent) {
    const by =
        actor === 'teacher'
            ? ' oleh guru'
            : actor === 'admin'
              ? ' oleh admin'
              : '';
    const other = otherClass ?? 'kelas lain';
    const happened = {
        joined: by ? 'dimasukkan ke kelas ini' : 'bergabung',
        left: 'keluar',
        moved:
            direction === 'in'
                ? `dipindahkan dari ${other}`
                : `dipindahkan ke ${other}`,
        deactivated: 'dinonaktifkan',
        reactivated: 'diaktifkan lagi',
        archived: 'diarsipkan',
    }[action];

    return `${student.name} ${happened}${by}.`;
}

function Section({
    title,
    count,
    children,
}: {
    title: string;
    count?: number;
    children: ReactNode;
}) {
    return (
        <Card>
            <details>
                <summary className="focus-visible:outline-ring cursor-pointer rounded py-2.5 text-lg font-semibold focus-visible:outline-3">
                    {title}
                    {count !== undefined && (
                        <>
                            {' '}
                            <span className="text-muted-foreground ml-1 text-sm font-normal tabular-nums">
                                {count}
                            </span>
                        </>
                    )}
                </summary>
                <div className="pt-2">{children}</div>
            </details>
        </Card>
    );
}

export function MembershipHistory({ classId }: { classId: number }) {
    const query = useQuery(classMembershipQuery(classId));
    const { data } = query;
    const waiting = query.isPending ? (
        <p role="status">Memuat riwayat keanggotaan…</p>
    ) : (
        <div className="space-y-3">
            <RequestError error={query.error} />
            <Button
                onClick={() => {
                    void query.refetch();
                }}
            >
                Muat ulang riwayat keanggotaan
            </Button>
        </div>
    );

    return (
        <>
            <Section title="Anggota lama" count={data?.past.length}>
                {!data ? (
                    waiting
                ) : data.past.length === 0 ? (
                    <p>
                        Belum ada anggota lama. Siswa yang keluar, dipindahkan,
                        atau diarsipkan muncul di sini.
                    </p>
                ) : (
                    <ul className="divide-paper-edge divide-y">
                        {data.past.map((member) => (
                            <li
                                key={member.studentId}
                                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
                            >
                                <div className="min-w-0 space-y-1">
                                    <p className="font-semibold break-words">
                                        {member.name}
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                        {reasons[member.reason]} · Anggota{' '}
                                        {day.format(new Date(member.joinedAt))}{' '}
                                        sampai{' '}
                                        {day.format(new Date(member.endedAt))}
                                    </p>
                                    <p className="text-sm tabular-nums">
                                        {member.submitted} misi dikirim
                                    </p>
                                </div>
                                <Link
                                    to={`/teacher/classes/${classId}/students/${member.studentId}`}
                                    className={textLink}
                                >
                                    Lihat hasil belajar
                                    <span className="sr-only">
                                        {' '}
                                        {member.name}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
            <Section title="Riwayat keanggotaan">
                {!data ? (
                    waiting
                ) : data.events.length === 0 ? (
                    <p>Belum ada perubahan keanggotaan yang tercatat.</p>
                ) : (
                    <>
                        <ul className="divide-paper-edge divide-y">
                            {data.events.map((event) => (
                                <li key={event.id} className="space-y-1 py-3">
                                    <p className="break-words">
                                        {eventSentence(event)}
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                        {day.format(new Date(event.createdAt))}
                                    </p>
                                </li>
                            ))}
                        </ul>
                        {data.events.length === EVENT_LIMIT && (
                            <p className="text-muted-foreground pt-3 text-sm">
                                Menampilkan {EVENT_LIMIT} perubahan terbaru.
                            </p>
                        )}
                    </>
                )}
            </Section>
        </>
    );
}
