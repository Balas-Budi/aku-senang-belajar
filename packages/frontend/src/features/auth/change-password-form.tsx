import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { meQuery, roleHome, useChangePassword } from './queries';
import { PasswordField } from './password-field';
import { Button } from '../../components/ui/button';
import { RequestError } from '../../components/request-error';

export function ChangePasswordForm() {
    const { data: user } = useQuery(meQuery());
    const change = useChangePassword();
    const [success, setSuccess] = useState(false);
    const [mismatch, setMismatch] = useState(false);
    if (!user) return null;
    return (
        <section className="mx-auto max-w-xl space-y-6">
            <Link
                to={roleHome(user.role)}
                className="text-primary inline-block min-h-11 py-3 underline"
            >
                Kembali ke ruangmu
            </Link>
            <div>
                <h1 className="text-primary-deep text-3xl font-bold">
                    Ganti kata sandi
                </h1>
                <p className="text-muted-foreground mt-3 leading-relaxed">
                    Buat kata sandimu sendiri. Setelah disimpan, perangkat lain
                    akan keluar dari akun ini. Kamu tetap masuk di perangkat
                    ini.
                </p>
            </div>
            <form
                className="space-y-5"
                onChange={() => {
                    setSuccess(false);
                    setMismatch(false);
                }}
                onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const input = new FormData(form);
                    const currentPassword = String(
                        input.get('currentPassword') ?? '',
                    );
                    const newPassword = String(input.get('newPassword') ?? '');
                    if (newPassword !== input.get('confirmPassword')) {
                        setMismatch(true);
                        return;
                    }
                    setMismatch(false);
                    setSuccess(false);
                    change.mutate(
                        { currentPassword, newPassword },
                        {
                            onSuccess: () => {
                                form.reset();
                                change.reset();
                                setSuccess(true);
                            },
                        },
                    );
                }}
            >
                <PasswordField
                    name="currentPassword"
                    label="Kata sandi saat ini"
                    autoComplete="current-password"
                    required
                    error={change.error}
                />
                <PasswordField
                    name="newPassword"
                    label="Kata sandi baru"
                    autoComplete="new-password"
                    required
                    error={change.error}
                />
                <p className="text-muted-foreground text-sm">
                    Gunakan {user.role === 'student' ? '8' : '15'} sampai 128
                    karakter. Pilih kata sandi yang mudah kamu ingat dan sulit
                    ditebak orang lain.
                </p>
                <PasswordField
                    name="confirmPassword"
                    label="Ulangi kata sandi baru"
                    autoComplete="new-password"
                    required
                    aria-invalid={mismatch}
                    aria-describedby={
                        mismatch ? 'confirm-password-error' : undefined
                    }
                />
                {mismatch && (
                    <p
                        id="confirm-password-error"
                        role="alert"
                        className="text-destructive"
                    >
                        Kata sandi baru belum sama. Periksa kedua isian.
                    </p>
                )}
                <RequestError error={change.error} />
                <Button type="submit" disabled={change.isPending}>
                    {change.isPending
                        ? 'Menyimpan kata sandi…'
                        : 'Simpan kata sandi'}
                </Button>
                {success && (
                    <p role="status" className="bg-secondary rounded-lg p-4">
                        Kata sandi berhasil diganti. Gunakan kata sandi barumu
                        saat masuk berikutnya.
                    </p>
                )}
            </form>
        </section>
    );
}
