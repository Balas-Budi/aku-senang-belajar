import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { PlusIcon } from '../../components/icons/workspace-icons';
import { PageHeader } from '../../components/page-header';
import { ErrorToast } from '../../components/request-error';
import { SectionTitle } from '../../components/section-title';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { ApiError } from '../../lib/api';
import { SubjectArt } from '../assignments/subject-art';
import { subjectsQuery, type SubjectInfo, useDeleteSubject } from './queries';
import { SubjectForm } from './subject-form';

function inUseText(error: unknown) {
    if (!(error instanceof ApiError) || error.body.name !== 'SUBJECT_IN_USE')
        return null;
    const details = error.body.details as unknown as {
        books?: number;
        notes?: number;
    };
    const books = details?.books ?? 0;
    return books > 0
        ? `Masih dipakai ${books} buku. Pindahkan dulu bukunya ke mata pelajaran lain.`
        : 'Masih dipakai catatan belajar siswa, jadi belum bisa dihapus.';
}

function RemoveSubject({
    subject,
    onDone,
}: {
    subject: SubjectInfo;
    onDone: (text: string) => void;
}) {
    const remove = useDeleteSubject();
    const [open, setOpen] = useState(false);
    const titleId = useId();
    return (
        <>
            <Button
                variant="outline"
                className="min-h-11 bg-white px-4"
                onClick={() => {
                    remove.reset();
                    setOpen(true);
                }}
            >
                Hapus
            </Button>
            <Dialog
                open={open}
                onClose={() => {
                    if (!remove.isPending) setOpen(false);
                }}
                aria-labelledby={titleId}
            >
                <h2
                    id={titleId}
                    className="text-primary-deep text-xl font-bold"
                >
                    Hapus {subject.name}?
                </h2>
                <p className="text-muted-foreground mt-2 leading-relaxed">
                    {subject.books > 0
                        ? `Mata pelajaran ini masih dipakai ${subject.books} buku, jadi belum bisa dihapus.`
                        : 'Mata pelajaran ini tidak dipakai buku mana pun. Guru tidak bisa memilihnya lagi.'}
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-3">
                    <Button
                        variant="outline"
                        disabled={remove.isPending}
                        onClick={() => setOpen(false)}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={remove.isPending}
                        onClick={() =>
                            remove.mutate(subject.key, {
                                onSuccess: () => {
                                    setOpen(false);
                                    onDone(`${subject.name} dihapus.`);
                                },
                                onError: () => setOpen(false),
                            })
                        }
                    >
                        {remove.isPending ? 'Menghapus…' : 'Hapus'}
                    </Button>
                </div>
            </Dialog>
            <ErrorToast
                error={remove.error}
                message={inUseText(remove.error)}
            />
        </>
    );
}

export function SubjectAdmin() {
    const subjects = useQuery(subjectsQuery());
    const [message, setMessage] = useState('');
    return (
        <div className="space-y-6">
            <PageHeader
                title="Mata pelajaran"
                description="Daftar mata pelajaran yang bisa dipilih guru saat mengunggah buku."
            />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
                <Card>
                    <section
                        aria-labelledby="subject-list-title"
                        className="space-y-3"
                    >
                        <h2
                            id="subject-list-title"
                            className="font-display text-primary-deep text-xl font-semibold sm:text-2xl"
                        >
                            Semua mata pelajaran
                            {subjects.data && (
                                <span className="text-muted-foreground ml-2 text-base font-normal tabular-nums">
                                    {subjects.data.length}
                                </span>
                            )}
                        </h2>
                        {subjects.isPending ? (
                            <p role="status">Memuat mata pelajaran…</p>
                        ) : subjects.isError ? (
                            <div className="space-y-3">
                                <ErrorToast error={subjects.error} />
                                <Button
                                    onClick={() => {
                                        void subjects.refetch();
                                    }}
                                >
                                    Muat ulang
                                </Button>
                            </div>
                        ) : (
                            <ul className="divide-paper-edge divide-y">
                                {subjects.data.map((subject) => (
                                    <li
                                        key={subject.key}
                                        className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
                                    >
                                        <SubjectArt
                                            subject={subject.key}
                                            className="size-12"
                                        />
                                        <div className="min-w-0 flex-1 basis-40">
                                            <p className="font-semibold break-words">
                                                {subject.name}
                                            </p>
                                            <p className="text-muted-foreground text-sm">
                                                {subject.books === 0
                                                    ? 'Belum dipakai buku'
                                                    : `Dipakai ${subject.books} buku`}
                                                {subject.builtIn && ' · Bawaan'}
                                            </p>
                                        </div>
                                        <RemoveSubject
                                            subject={subject}
                                            onDone={setMessage}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p role="status" className="sr-only">
                            {message}
                        </p>
                    </section>
                </Card>
                <Card>
                    <section
                        aria-labelledby="subject-new-title"
                        className="space-y-4"
                    >
                        <SectionTitle
                            id="subject-new-title"
                            icon={<PlusIcon />}
                        >
                            Tambah mata pelajaran
                        </SectionTitle>
                        <SubjectForm
                            onCreated={(subject) =>
                                setMessage(`${subject.name} ditambahkan.`)
                            }
                        />
                    </section>
                </Card>
            </div>
        </div>
    );
}
