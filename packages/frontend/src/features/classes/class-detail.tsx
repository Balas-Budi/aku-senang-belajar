import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { classesQuery, useChangeCode } from './queries';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { RequestError } from '../../components/request-error';
import { ChallengeCard } from '../challenges/challenge-card';
import { ClassMissions } from '../results/class-missions';
import { ClassChapters } from './class-chapters';
import { ClassRoster } from './class-roster';
import { MembershipHistory } from './membership-history';
export function ClassDetail({ id }: { id: number }) {
    const classes = useQuery(classesQuery());
    const change = useChangeCode(id);
    const [confirm, setConfirm] = useState<'POST' | 'DELETE' | null>(null);
    const [copyMessage, setCopyMessage] = useState('');
    const classroom = classes.data?.find((item) => item.id === id);
    if (!classroom)
        return <p>Kelas tidak ditemukan dalam daftar kelas Anda.</p>;
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">{classroom.name}</h1>
            <ClassChapters classId={id} />
            <ClassMissions classId={id} />
            <ChallengeCard classId={id} />
            <div className="grid items-start gap-6 lg:grid-cols-12">
                <div className="min-w-0 space-y-6 lg:col-span-8">
                    <ClassRoster classId={id} />
                    <MembershipHistory classId={id} />
                </div>
                <Card className="lg:col-span-4">
                    <section
                        aria-labelledby="invite-title"
                        className="space-y-4"
                    >
                        <h2 id="invite-title" className="text-lg font-semibold">
                            Undang siswa
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Bagikan kode ini hanya kepada siswa di kelas Anda.
                        </p>
                        <p className="bg-secondary text-primary-deep rounded-lg px-4 py-3 text-2xl font-bold break-all">
                            {classroom.inviteCode ?? 'Kode dinonaktifkan'}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            {classroom.inviteCode && (
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(
                                                classroom.inviteCode ?? '',
                                            );
                                            setCopyMessage('Kode disalin.');
                                        } catch {
                                            setCopyMessage(
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
                                onClick={() => setConfirm('POST')}
                            >
                                {classroom.inviteCode
                                    ? 'Ganti kode'
                                    : 'Aktifkan kode baru'}
                            </Button>
                            {classroom.inviteCode && (
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirm('DELETE')}
                                >
                                    Tutup pendaftaran
                                </Button>
                            )}
                        </div>
                        <p role="status">{copyMessage}</p>
                        {confirm && (
                            <div className="space-y-3">
                                <p>
                                    {confirm === 'POST'
                                        ? 'Kode lama tidak bisa dipakai lagi. Siswa yang sudah bergabung tetap di kelas.'
                                        : 'Siswa baru tidak dapat bergabung. Siswa yang sudah bergabung tetap di kelas.'}
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        disabled={change.isPending}
                                        onClick={() =>
                                            change.mutate(confirm, {
                                                onSuccess: () => {
                                                    setConfirm(null);
                                                    setCopyMessage(
                                                        'Pengaturan kode diperbarui.',
                                                    );
                                                },
                                            })
                                        }
                                    >
                                        {change.isPending
                                            ? 'Menyimpan…'
                                            : 'Konfirmasi'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => setConfirm(null)}
                                    >
                                        Batal
                                    </Button>
                                </div>
                            </div>
                        )}
                        <RequestError error={change.error} />
                    </section>
                </Card>
            </div>
        </div>
    );
}
