import { useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { fieldErrorText } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { ApiError } from '../../lib/api';
import { focusHeading } from '../studio/studio-labels';
import {
    classesQuery,
    rosterQuery,
    useChangeMembership,
    type MembershipAction,
    type RosterStudent,
    type TeacherClass,
} from './queries';

type Request = { student: RosterStudent; action: MembershipAction };

const labels: Record<MembershipAction, string> = {
    move: 'Pindahkan',
    deactivate: 'Nonaktifkan',
    reactivate: 'Aktifkan lagi',
    archive: 'Arsipkan',
};

const pendingLabels: Record<MembershipAction, string> = {
    move: 'Memindahkan…',
    deactivate: 'Menonaktifkan…',
    reactivate: 'Mengaktifkan…',
    archive: 'Mengarsipkan…',
};

const notes: Record<MembershipAction, string> = {
    move: 'Hasil belajarnya di kelas ini tetap bisa Anda baca di Anggota lama.',
    deactivate:
        'Siswa tetap ada di daftar kelas, tetapi tidak bisa membuka misi sampai Anda mengaktifkannya lagi.',
    reactivate: 'Siswa bisa membuka misi lagi.',
    archive:
        'Siswa keluar dari kelas ini. Hasil belajarnya tetap bisa Anda baca di Anggota lama, dan ia bisa bergabung lagi dengan kode kelas.',
};

const done: Record<MembershipAction, string> = {
    move: 'dipindahkan ke',
    deactivate: 'dinonaktifkan',
    reactivate: 'diaktifkan lagi',
    archive: 'diarsipkan',
};

function refusalOf(error: Error | null) {
    if (!(error instanceof ApiError)) return null;
    if (error.status === 404)
        return 'Siswa ini sudah tidak ada di kelas ini. Tutup, lalu periksa daftar siswa.';
    if (error.body.name === 'MEMBERSHIP_STATE')
        return 'Status siswa ini sudah berubah. Tutup, lalu periksa daftar siswa.';
    return null;
}

function MembershipDialog({
    classId,
    request: { student, action },
    others,
    open,
    onClose,
    onChanged,
}: {
    classId: number;
    request: Request;
    others: TeacherClass[];
    open: boolean;
    onClose: () => void;
    onChanged: (message: string) => void;
}) {
    const change = useChangeMembership(classId);
    const cancel = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const noteId = useId();
    const fieldId = useId();
    const refusal = refusalOf(change.error);
    const fieldError = fieldErrorText(change.error, 'classId');
    const refused = refusal !== null;

    useEffect(() => {
        if (open) cancel.current?.focus();
    }, [open, refused]);

    const close = (dialog?: HTMLDialogElement) => {
        if (change.isPending) {
            if (dialog && !dialog.open) dialog.showModal();
            return;
        }
        change.reset();
        onClose();
    };
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (change.isPending) return;
        const chosen = Number(new FormData(event.currentTarget).get('classId'));
        const target = others.find(({ id }) => id === chosen);
        if (action === 'move' && !target) return;
        change.mutate(
            { studentId: student.id, action, classId: target?.id },
            {
                onSuccess: () =>
                    onChanged(
                        `${student.name} ${done[action]}${target ? ` ${target.name}` : ''}.`,
                    ),
            },
        );
    };

    return (
        <Dialog
            open={open}
            onClose={close}
            onCancel={(event) => {
                if (change.isPending) event.preventDefault();
            }}
            aria-labelledby={titleId}
            aria-describedby={noteId}
        >
            <form onSubmit={submit}>
                <h2
                    id={titleId}
                    className="text-primary-deep text-xl font-bold break-words"
                >
                    {labels[action]} {student.name}?
                </h2>
                <p
                    id={noteId}
                    className="text-muted-foreground mt-2 leading-relaxed"
                >
                    {notes[action]}
                </p>
                <div className="mt-5 space-y-4">
                    {action === 'move' && !refused && (
                        <div className="space-y-2">
                            <label
                                htmlFor={fieldId}
                                className="block font-medium"
                            >
                                Kelas tujuan
                            </label>
                            <select
                                id={fieldId}
                                name="classId"
                                required
                                defaultValue={
                                    others.length === 1 ? others[0]?.id : ''
                                }
                                aria-invalid={fieldError !== null}
                                aria-describedby={
                                    fieldError ? `${fieldId}-error` : undefined
                                }
                                className="border-border bg-background focus-visible:outline-ring aria-invalid:border-destructive min-h-12 w-full rounded-lg border px-3 focus-visible:outline-3"
                            >
                                <option value="">Pilih kelas</option>
                                {others.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name} · {item.studentCount} siswa
                                    </option>
                                ))}
                            </select>
                            {fieldError && (
                                <p
                                    id={`${fieldId}-error`}
                                    className="text-destructive"
                                >
                                    {fieldError}
                                </p>
                            )}
                        </div>
                    )}
                    {refusal ? (
                        <Alert tone="attention" role="alert">
                            {refusal}
                        </Alert>
                    ) : (
                        !fieldError && <RequestError error={change.error} />
                    )}
                    <div className="flex flex-wrap gap-3">
                        <Button
                            ref={cancel}
                            variant="outline"
                            disabled={change.isPending}
                            onClick={() => close()}
                        >
                            {refused ? 'Tutup' : 'Batal'}
                        </Button>
                        {!refused && (
                            <Button
                                type="submit"
                                variant={
                                    action === 'archive'
                                        ? 'destructive'
                                        : 'primary'
                                }
                                aria-disabled={change.isPending}
                                className="aria-disabled:opacity-60"
                            >
                                {change.isPending
                                    ? pendingLabels[action]
                                    : labels[action]}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </Dialog>
    );
}

export function ClassRoster({ classId }: { classId: number }) {
    const roster = useQuery(rosterQuery(classId));
    const classes = useQuery(classesQuery());
    const [managing, setManaging] = useState<number | null>(null);
    const [request, setRequest] = useState<Request | null>(null);
    const [asking, setAsking] = useState(false);
    const [message, setMessage] = useState({ text: '', count: 0 });
    const heading = useRef<HTMLHeadingElement>(null);
    const changed = useRef(false);
    const others = classes.data?.filter(({ id }) => id !== classId) ?? [];

    const ask = (student: RosterStudent, action: MembershipAction) => {
        setRequest({ student, action });
        setAsking(true);
    };
    const closeDialog = () => {
        setAsking(false);
        if (changed.current) {
            changed.current = false;
            heading.current?.focus();
        }
    };
    const finish = (text: string) => {
        changed.current = true;
        setAsking(false);
        setManaging(null);
        setMessage((previous) => ({ text, count: previous.count + 1 }));
    };

    return (
        <Card>
            <section aria-labelledby="roster-title">
                <h2
                    id="roster-title"
                    ref={heading}
                    tabIndex={-1}
                    className={`text-lg font-semibold ${focusHeading}`}
                >
                    Siswa yang bergabung{' '}
                    <span className="text-muted-foreground ml-1 text-sm font-normal tabular-nums">
                        {roster.data?.length ?? ''}
                    </span>
                </h2>
                <p role="status" className="text-primary-deep mb-2 font-medium">
                    <span key={message.count}>{message.text}</span>
                </p>
                {roster.data ? (
                    roster.data.length === 0 ? (
                        <p>
                            Belum ada siswa. Bagikan kode kelas agar siswa dapat
                            bergabung.
                        </p>
                    ) : (
                        <ul className="divide-paper-edge divide-y">
                            {roster.data.map((student) => {
                                const open = managing === student.id;
                                const panelId = `roster-manage-${student.id}`;

                                return (
                                    <li key={student.id} className="py-3">
                                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                            <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                                <span className="min-w-0 break-words">
                                                    {student.name}
                                                </span>
                                                {student.inactive && (
                                                    <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-sm font-medium">
                                                        Nonaktif
                                                    </span>
                                                )}
                                            </p>
                                            <Button
                                                variant="outline"
                                                aria-expanded={open}
                                                aria-controls={panelId}
                                                onClick={() =>
                                                    setManaging(
                                                        open
                                                            ? null
                                                            : student.id,
                                                    )
                                                }
                                            >
                                                Kelola
                                                <span className="sr-only">
                                                    {' '}
                                                    {student.name}
                                                </span>
                                            </Button>
                                        </div>
                                        {open && (
                                            <div
                                                id={panelId}
                                                role="group"
                                                aria-label={`Kelola ${student.name}`}
                                                className="flex flex-wrap gap-2 pt-3"
                                            >
                                                {others.length > 0 && (
                                                    <Button
                                                        variant="outline"
                                                        onClick={() =>
                                                            ask(student, 'move')
                                                        }
                                                    >
                                                        Pindahkan ke kelas lain
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        ask(
                                                            student,
                                                            student.inactive
                                                                ? 'reactivate'
                                                                : 'deactivate',
                                                        )
                                                    }
                                                >
                                                    {student.inactive
                                                        ? 'Aktifkan lagi'
                                                        : 'Nonaktifkan'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        ask(student, 'archive')
                                                    }
                                                >
                                                    Arsipkan
                                                </Button>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )
                ) : roster.isPending ? (
                    <p role="status">Memuat siswa…</p>
                ) : (
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
                )}
            </section>
            {request && (
                <MembershipDialog
                    key={`${request.student.id}-${request.action}`}
                    classId={classId}
                    request={request}
                    others={others}
                    open={asking}
                    onClose={closeDialog}
                    onChanged={finish}
                />
            )}
        </Card>
    );
}
