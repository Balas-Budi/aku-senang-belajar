import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    adminClassesQuery,
    useDeleteMemory,
    useMoveStudent,
    useResetPassword,
    type ManagedUser,
} from './queries';
import { CredentialSheet } from './credential-sheet';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { TableCell, TableRow } from '../../components/ui/table';
import { RequestError } from '../../components/request-error';
import { cn } from '../../lib/cn';
function ClassPlacement({
    user,
    onSave,
}: {
    user: ManagedUser;
    onSave: () => void;
}) {
    const classes = useQuery(adminClassesQuery());
    const move = useMoveStudent();
    const [message, setMessage] = useState('');
    return (
        <div className="space-y-3">
            <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    const value = String(
                        new FormData(event.currentTarget).get('classId') ?? '',
                    );
                    onSave();
                    move.mutate(
                        { id: user.id, classId: value ? Number(value) : null },
                        {
                            onSuccess: () =>
                                setMessage('Penempatan kelas disimpan.'),
                        },
                    );
                }}
            >
                <label className="min-w-48 flex-1 space-y-2">
                    <span className="block">Kelas untuk {user.name}</span>
                    <select
                        name="classId"
                        defaultValue={user.classroom?.id ?? ''}
                        disabled={classes.isPending || classes.isError}
                        className="border-border bg-background focus-visible:outline-ring min-h-12 w-full rounded-lg border px-3 focus-visible:outline-3"
                    >
                        <option value="">Tanpa kelas</option>
                        {classes.data?.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name} · {item.teacherName}
                            </option>
                        ))}
                    </select>
                </label>
                <Button
                    type="submit"
                    disabled={
                        move.isPending || classes.isPending || classes.isError
                    }
                >
                    {move.isPending ? 'Menyimpan…' : 'Simpan kelas'}
                </Button>
            </form>
            {classes.isError && (
                <>
                    <RequestError error={classes.error} />
                    <Button
                        variant="outline"
                        onClick={() => {
                            void classes.refetch();
                        }}
                    >
                        Muat ulang pilihan kelas
                    </Button>
                </>
            )}
            <RequestError error={move.error} />
            <p role="status">{message}</p>
        </div>
    );
}
function ForgetMemory({
    user,
    open,
    onClose,
    onDone,
}: {
    user: ManagedUser;
    open: boolean;
    onClose: () => void;
    onDone: () => void;
}) {
    const forget = useDeleteMemory();
    const close = () => {
        if (forget.isPending) return;
        forget.reset();
        onClose();
    };
    return (
        <Dialog
            open={open}
            onClose={close}
            onCancel={(event) => {
                if (forget.isPending) event.preventDefault();
            }}
            aria-labelledby={`forget-${user.id}-title`}
            aria-describedby={`forget-${user.id}-description`}
        >
            <h2
                id={`forget-${user.id}-title`}
                className="text-primary-deep text-xl font-bold"
            >
                Hapus memori belajar {user.name}?
            </h2>
            <p
                id={`forget-${user.id}-description`}
                className="text-muted-foreground mt-2 leading-relaxed"
            >
                Ringkasan setiap misi, laporan siswa, dan urutan bantuan yang
                disarankan AI atau diatur guru dihapus dan tidak bisa
                dipulihkan. Misi yang sudah dikerjakan tidak diringkas lagi.
                Jawaban, latihan, hasil misi, dan keputusan guru tentang
                pemahaman tetap tersimpan.
            </p>
            <div className="mt-5 space-y-4">
                <RequestError error={forget.error} />
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="outline"
                        disabled={forget.isPending}
                        onClick={close}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        disabled={forget.isPending}
                        onClick={() =>
                            forget.mutate(user.id, { onSuccess: onDone })
                        }
                    >
                        {forget.isPending
                            ? 'Menghapus…'
                            : 'Hapus memori belajar'}
                    </Button>
                </div>
            </div>
        </Dialog>
    );
}
export function AccountRow({
    user,
    onClassSave,
}: {
    user: ManagedUser;
    onClassSave: () => void;
}) {
    const [open, setOpen] = useState<'reset' | 'class' | null>(null);
    const [forgetting, setForgetting] = useState<boolean | null>(null);
    const [forgotten, setForgotten] = useState(false);
    const reset = useResetPassword();
    const resetToggle = useRef<HTMLButtonElement>(null);
    const student = user.role === 'student';
    const expanded = open !== null || reset.data !== undefined;
    const toggle = (panel: 'reset' | 'class') =>
        setOpen(open === panel ? null : panel);
    const closeReset = () => {
        setOpen(null);
        reset.reset();
        resetToggle.current?.focus();
    };
    const cell = '@max-xl:block @max-xl:py-1';
    return (
        <>
            <TableRow
                className={cn(
                    '@max-xl:block @max-xl:py-2',
                    expanded && 'border-b-0',
                )}
            >
                <TableCell className={cell}>
                    <span className="block font-semibold break-words">
                        {user.name}
                    </span>
                    <span className="text-muted-foreground block break-all">
                        {user.username}
                    </span>
                </TableCell>
                {student && (
                    <TableCell className={cell}>
                        <span className="text-muted-foreground @xl:hidden">
                            Kelas:{' '}
                        </span>
                        {user.classroom ? (
                            `${user.classroom.name} · ${user.classroom.teacherName}`
                        ) : (
                            <span className="text-muted-foreground">
                                Belum bergabung ke kelas
                            </span>
                        )}
                    </TableCell>
                )}
                <TableCell className={cell}>
                    <div className="flex flex-wrap gap-2 @xl:justify-end">
                        <Button
                            ref={resetToggle}
                            variant="outline"
                            aria-expanded={open === 'reset'}
                            onClick={() => toggle('reset')}
                        >
                            Atur ulang kata sandi
                            <span className="sr-only"> {user.name}</span>
                        </Button>
                        {student && (
                            <Button
                                variant="outline"
                                aria-expanded={open === 'class'}
                                onClick={() => toggle('class')}
                            >
                                Ubah kelas
                                <span className="sr-only"> {user.name}</span>
                            </Button>
                        )}
                        {student && (
                            <Button
                                variant="outline"
                                className="text-destructive"
                                onClick={() => {
                                    setForgotten(false);
                                    setForgetting(true);
                                }}
                            >
                                Hapus memori belajar
                                <span className="sr-only"> {user.name}</span>
                            </Button>
                        )}
                    </div>
                    {student && (
                        <>
                            {forgetting !== null && (
                                <ForgetMemory
                                    user={user}
                                    open={forgetting}
                                    onClose={() => setForgetting(false)}
                                    onDone={() => {
                                        setForgetting(false);
                                        setForgotten(true);
                                    }}
                                />
                            )}
                            <p
                                role="status"
                                className="mt-2 empty:mt-0 @xl:text-right"
                            >
                                {forgotten
                                    ? `Memori belajar ${user.name} sudah dihapus.`
                                    : ''}
                            </p>
                        </>
                    )}
                </TableCell>
            </TableRow>
            {expanded && (
                <tr className="border-paper-edge bg-muted/50 border-b last:border-b-0 @max-xl:block">
                    <td
                        colSpan={student ? 3 : 2}
                        className="space-y-4 px-4 py-4 @max-xl:block"
                    >
                        {open === 'reset' && (
                            <div className="space-y-3">
                                <p>
                                    Atur ulang kata sandi {user.name}? Semua
                                    sesi akun ini akan berakhir.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        disabled={reset.isPending}
                                        onClick={() =>
                                            reset.mutate(user.id, {
                                                onSuccess: () =>
                                                    setOpen((current) =>
                                                        current === 'reset'
                                                            ? null
                                                            : current,
                                                    ),
                                            })
                                        }
                                    >
                                        {reset.isPending
                                            ? 'Mengatur ulang…'
                                            : 'Ya, atur ulang'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        disabled={reset.isPending}
                                        onClick={closeReset}
                                    >
                                        Batal
                                    </Button>
                                </div>
                                <RequestError error={reset.error} />
                            </div>
                        )}
                        {open === 'class' && (
                            <ClassPlacement user={user} onSave={onClassSave} />
                        )}
                        {reset.data && (
                            <CredentialSheet
                                items={[
                                    {
                                        username: user.username,
                                        password: reset.data.password,
                                    },
                                ]}
                                onClose={() => {
                                    reset.reset();
                                    resetToggle.current?.focus();
                                }}
                            />
                        )}
                    </td>
                </tr>
            )}
        </>
    );
}
