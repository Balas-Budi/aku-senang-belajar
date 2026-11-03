import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    adminClassesQuery,
    useMoveStudent,
    useResetPassword,
    type ManagedUser,
} from './queries';
import { CredentialSheet } from './credential-sheet';
import { Button } from '../../components/ui/button';
import { RequestError } from '../../components/request-error';
export function AccountRow({ user }: { user: ManagedUser }) {
    const reset = useResetPassword();
    const move = useMoveStudent();
    const classes = useQuery(adminClassesQuery());
    const [confirmReset, setConfirmReset] = useState(false);
    const [message, setMessage] = useState('');
    return (
        <li className="space-y-4 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                    <h3 className="text-lg font-semibold break-words">
                        {user.name}
                    </h3>
                    <p className="text-muted-foreground break-all">
                        {user.username}
                    </p>
                    {user.role === 'student' && (
                        <p className="mt-2">
                            {user.classroom
                                ? `${user.classroom.name} · ${user.classroom.teacherName}`
                                : 'Belum bergabung ke kelas'}
                        </p>
                    )}
                </div>
                <Button variant="outline" onClick={() => setConfirmReset(true)}>
                    Atur ulang kata sandi
                </Button>
            </div>
            {confirmReset && !reset.data && (
                <div className="bg-muted space-y-3 rounded-lg p-4">
                    <p>
                        Atur ulang kata sandi {user.name}? Semua sesi akun ini
                        akan berakhir.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            disabled={reset.isPending}
                            onClick={() =>
                                reset.mutate(user.id, {
                                    onSuccess: () => setConfirmReset(false),
                                })
                            }
                        >
                            {reset.isPending
                                ? 'Mengatur ulang…'
                                : 'Ya, atur ulang'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setConfirmReset(false);
                                reset.reset();
                            }}
                        >
                            Batal
                        </Button>
                    </div>
                </div>
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
                        setConfirmReset(false);
                    }}
                />
            )}
            <RequestError error={reset.error} />
            {user.role === 'student' && (
                <details>
                    <summary className="text-primary cursor-pointer py-3 underline">
                        Ubah penempatan kelas
                    </summary>
                    <form
                        className="mt-3 flex flex-wrap items-end gap-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            const value = String(
                                new FormData(event.currentTarget).get(
                                    'classId',
                                ) ?? '',
                            );
                            move.mutate(
                                {
                                    id: user.id,
                                    classId: value ? Number(value) : null,
                                },
                                {
                                    onSuccess: () =>
                                        setMessage(
                                            'Penempatan kelas disimpan.',
                                        ),
                                },
                            );
                        }}
                    >
                        <label className="min-w-0 flex-1 space-y-2">
                            <span className="block">
                                Kelas untuk {user.name}
                            </span>
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
                                move.isPending ||
                                classes.isPending ||
                                classes.isError
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
                </details>
            )}
        </li>
    );
}
