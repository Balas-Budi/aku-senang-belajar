import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useDeleteAccount, type User } from './queries';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { RequestError } from '../../components/request-error';
export function DeleteAccount({ user }: { user: User }) {
    const remove = useDeleteAccount();
    const client = useQueryClient();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [mismatch, setMismatch] = useState(false);
    const close = () => {
        if (remove.isPending) return;
        setOpen(false);
        setMismatch(false);
        remove.reset();
    };
    return (
        <section
            aria-labelledby="delete-account-title"
            className="border-border space-y-4 border-t pt-8"
        >
            <h2
                id="delete-account-title"
                className="text-primary-deep text-2xl font-bold"
            >
                Hapus akun
            </h2>
            <p className="text-muted-foreground leading-relaxed">
                Menghapus akun mengeluarkanmu dari semua perangkat, dan akun ini
                tidak bisa dipulihkan.
            </p>
            <Button
                variant="outline"
                className="text-destructive"
                onClick={() => setOpen(true)}
            >
                Hapus akun
            </Button>
            <Dialog
                open={open}
                onClose={close}
                onCancel={(event) => {
                    if (remove.isPending) event.preventDefault();
                }}
                aria-labelledby="delete-account-dialog-title"
                aria-describedby="delete-account-dialog-description"
            >
                <h2
                    id="delete-account-dialog-title"
                    className="text-primary-deep text-xl font-bold"
                >
                    Hapus akunmu?
                </h2>
                <p
                    id="delete-account-dialog-description"
                    className="text-muted-foreground mt-2 leading-relaxed"
                >
                    Kamu tidak bisa masuk lagi dengan akun ini.{' '}
                    {user.role === 'teacher'
                        ? 'Kelas yang kamu buat tetap ada bersama siswanya, tetapi kamu tidak bisa membukanya lagi.'
                        : 'Kalau kamu satu-satunya admin, sekolah tidak punya admin lagi sampai tim teknis membuat admin baru.'}
                </p>
                <form
                    className="mt-5 space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const typed = String(
                            new FormData(event.currentTarget).get(
                                'confirmUsername',
                            ) ?? '',
                        );
                        if (typed.trim().toLowerCase() !== user.username) {
                            setMismatch(true);
                            return;
                        }
                        remove.mutate(undefined, {
                            onSuccess: async () => {
                                await navigate('/login?account=deleted', {
                                    replace: true,
                                });
                                client.clear();
                            },
                        });
                    }}
                >
                    <div className="space-y-2">
                        <label
                            htmlFor="confirm-username"
                            className="block font-medium"
                        >
                            Ketik nama penggunamu,{' '}
                            <span className="font-bold break-all">
                                {user.username}
                            </span>
                            , untuk memastikan.
                        </label>
                        <Input
                            id="confirm-username"
                            name="confirmUsername"
                            autoComplete="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            autoFocus
                            required
                            aria-invalid={mismatch}
                            aria-describedby={
                                mismatch ? 'confirm-username-error' : undefined
                            }
                            onChange={() => setMismatch(false)}
                        />
                        {mismatch && (
                            <p
                                id="confirm-username-error"
                                role="alert"
                                className="text-destructive"
                            >
                                Nama pengguna belum sama. Periksa ketikanmu.
                            </p>
                        )}
                    </div>
                    <RequestError error={remove.error} />
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="outline"
                            disabled={remove.isPending}
                            onClick={close}
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={remove.isPending}
                        >
                            {remove.isPending
                                ? 'Menghapus akun…'
                                : 'Hapus akun saya'}
                        </Button>
                    </div>
                </form>
            </Dialog>
        </section>
    );
}
