import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { classesQuery, rosterQuery, useChangeCode } from './queries';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { RequestError } from '../../components/request-error';
import { ClassMissions } from '../results/class-missions';
export function ClassDetail({ id }: { id: number }) {
    const classes = useQuery(classesQuery());
    const roster = useQuery(rosterQuery(id));
    const change = useChangeCode(id);
    const [confirm, setConfirm] = useState<'POST' | 'DELETE' | null>(null);
    const [copyMessage, setCopyMessage] = useState('');
    const classroom = classes.data?.find((item) => item.id === id);
    if (!classroom)
        return <p>Kelas tidak ditemukan dalam daftar kelas Anda.</p>;
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold">{classroom.name}</h1>
            <ClassMissions classId={id} />
            <div className="grid items-start gap-6 lg:grid-cols-12">
                <Card className="lg:col-span-8">
                    <section aria-labelledby="roster-title">
                        <h2
                            id="roster-title"
                            className="mb-2 text-lg font-semibold"
                        >
                            Siswa yang bergabung
                            <span className="text-muted-foreground ml-2 text-sm font-normal tabular-nums">
                                {roster.data?.length ?? ''}
                            </span>
                        </h2>
                        {roster.isPending ? (
                            <p role="status">Memuat siswa…</p>
                        ) : roster.isError ? (
                            <div className="space-y-3">
                                <RequestError error={roster.error} />
                                <Button
                                    onClick={() => {
                                        void roster.refetch();
                                    }}
                                >
                                    Muat ulang siswa
                                </Button>
                            </div>
                        ) : roster.data.length === 0 ? (
                            <p>
                                Belum ada siswa. Bagikan kode kelas agar siswa
                                dapat bergabung.
                            </p>
                        ) : (
                            <ul className="divide-paper-edge divide-y">
                                {roster.data.map((student) => (
                                    <li key={student.id} className="py-3">
                                        {student.name}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </Card>
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
