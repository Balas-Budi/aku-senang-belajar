import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
    classChaptersQuery,
    classesQuery,
    type TeacherClass,
    useChangeCode,
} from './queries';
import {
    BookIcon,
    ClassIcon,
    SendIcon,
    SparkleIcon,
} from '../../components/icons/workspace-icons';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { RequestError } from '../../components/request-error';
import {
    SectionTabs,
    useSection,
    type SectionTab,
} from '../../components/section-tabs';
import { ChallengeCard } from '../challenges/challenge-card';
import { classChallengeQuery } from '../challenges/queries';
import { classMissionsQuery } from '../results/queries';
import { ClassMissions } from '../results/class-missions';
import { ClassChapters } from './class-chapters';
import { ClassRoster } from './class-roster';
import { MembershipHistory } from './membership-history';

function InviteCode({
    classId,
    classroom,
}: {
    classId: number;
    classroom: TeacherClass;
}) {
    const change = useChangeCode(classId);
    const [confirm, setConfirm] = useState<'POST' | 'DELETE' | null>(null);
    const [message, setMessage] = useState('');
    return (
        <section
            aria-labelledby="invite-title"
            className="bg-student-surface border-paper-edge space-y-3 rounded-2xl border p-4 lg:w-80 lg:shrink-0"
        >
            <h2 id="invite-title" className="text-base font-semibold">
                Kode undangan siswa
            </h2>
            <p className="font-display text-primary-deep text-3xl font-semibold tracking-wider break-all">
                {classroom.inviteCode ?? 'Pendaftaran ditutup'}
            </p>
            <p className="text-muted-foreground text-sm">
                Bagikan kode ini hanya kepada siswa di kelas Anda.
            </p>
            <div className="flex flex-wrap gap-2">
                {classroom.inviteCode && (
                    <Button
                        className="min-h-11 px-4"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(
                                    classroom.inviteCode ?? '',
                                );
                                setMessage('Kode disalin.');
                            } catch {
                                setMessage(
                                    'Belum bisa menyalin. Pilih dan salin kode di atas.',
                                );
                            }
                        }}
                    >
                        Salin kode
                    </Button>
                )}
                <Button
                    variant="outline"
                    className="min-h-11 bg-white px-4"
                    onClick={() => setConfirm('POST')}
                >
                    {classroom.inviteCode ? 'Ganti kode' : 'Aktifkan kode baru'}
                </Button>
                {classroom.inviteCode && (
                    <Button
                        variant="outline"
                        className="min-h-11 bg-white px-4"
                        onClick={() => setConfirm('DELETE')}
                    >
                        Tutup pendaftaran
                    </Button>
                )}
            </div>
            <p role="status" className="text-sm font-semibold empty:hidden">
                {message}
            </p>
            {confirm && (
                <div className="space-y-3 rounded-xl bg-white p-3">
                    <p>
                        {confirm === 'POST'
                            ? 'Kode lama tidak bisa dipakai lagi. Siswa yang sudah bergabung tetap di kelas.'
                            : 'Siswa baru tidak dapat bergabung. Siswa yang sudah bergabung tetap di kelas.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            className="min-h-11 px-4"
                            disabled={change.isPending}
                            onClick={() =>
                                change.mutate(confirm, {
                                    onSuccess: () => {
                                        setConfirm(null);
                                        setMessage(
                                            'Pengaturan kode diperbarui.',
                                        );
                                    },
                                })
                            }
                        >
                            {change.isPending ? 'Menyimpan…' : 'Konfirmasi'}
                        </Button>
                        <Button
                            variant="outline"
                            className="min-h-11 px-4"
                            onClick={() => setConfirm(null)}
                        >
                            Batal
                        </Button>
                    </div>
                </div>
            )}
            <RequestError error={change.error} />
        </section>
    );
}

export function ClassDetail({ id }: { id: number }) {
    const classes = useQuery(classesQuery());
    const missions = useQuery(classMissionsQuery(id)).data;
    const books = useQuery(classChaptersQuery(id)).data;
    const challenge = useQuery(classChallengeQuery(id)).data?.challenge;
    const classroom = classes.data?.find((item) => item.id === id);
    const opened = books
        ?.flatMap(({ chapters }) => chapters)
        .filter(({ openStages }) => openStages > 0).length;
    const tabs: SectionTab[] = [
        {
            key: 'misi',
            label: 'Misi',
            icon: <SendIcon className="size-5" />,
            badge: missions ? String(missions.length) : null,
        },
        {
            key: 'bab',
            label: 'Bab',
            icon: <BookIcon className="size-5" />,
            badge: opened === undefined ? null : String(opened),
        },
        {
            key: 'tantangan',
            label: 'Tantangan kelas',
            icon: <SparkleIcon className="size-5" />,
            badge: challenge?.state === 'open' ? 'Berjalan' : null,
        },
        {
            key: 'siswa',
            label: 'Siswa',
            icon: <ClassIcon className="size-5" />,
            badge: classroom ? String(classroom.studentCount) : null,
        },
    ];
    const section = useSection(tabs);
    if (!classroom)
        return <p>Kelas tidak ditemukan dalam daftar kelas Anda.</p>;
    return (
        <div className="space-y-6">
            <Card className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                    <span
                        aria-hidden="true"
                        className="bg-secondary text-primary-deep flex size-16 shrink-0 items-center justify-center rounded-2xl"
                    >
                        <ClassIcon className="size-8" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="font-display text-primary-deep text-3xl leading-tight font-semibold break-words sm:text-4xl">
                            {classroom.name}
                        </h1>
                        <p className="text-muted-foreground mt-1 text-lg">
                            {classroom.studentCount} siswa bergabung
                            {opened !== undefined && ` · ${opened} bab dibuka`}
                        </p>
                    </div>
                </div>
                <InviteCode classId={id} classroom={classroom} />
            </Card>
            <SectionTabs
                label={`Bagian kelas ${classroom.name}`}
                tabs={tabs}
                current={section}
            />
            {section === 'misi' && <ClassMissions classId={id} />}
            {section === 'bab' && <ClassChapters classId={id} />}
            {section === 'tantangan' && <ChallengeCard classId={id} />}
            {section === 'siswa' && (
                <div className="space-y-6">
                    <ClassRoster classId={id} />
                    <MembershipHistory classId={id} />
                </div>
            )}
        </div>
    );
}
