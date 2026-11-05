import { useState } from 'react';
import { useCreateUser, useImportUsers, type ManagedRole } from './queries';
import { CredentialSheet, type Credential } from './credential-sheet';
import { FormField } from '../../components/form-field';
import { Button } from '../../components/ui/button';
import { RequestError } from '../../components/request-error';
export function AccountCreate({ role }: { role: ManagedRole }) {
    const create = useCreateUser();
    const upload = useImportUsers();
    const [credentials, setCredentials] = useState<Credential[]>([]);
    const [message, setMessage] = useState('');
    return (
        <div className="grid items-start gap-6 lg:grid-cols-2">
            {credentials.length > 0 && (
                <div className="lg:col-span-2">
                    <CredentialSheet
                        items={credentials}
                        onClose={() => {
                            setCredentials([]);
                            create.reset();
                            upload.reset();
                        }}
                    />
                </div>
            )}
            <details className="border-paper-edge bg-background rounded-2xl border p-5">
                <summary className="focus-visible:outline-ring cursor-pointer py-2 text-lg font-semibold focus-visible:outline-3">
                    Buat akun {role === 'student' ? 'siswa' : 'guru'}
                </summary>
                <form
                    className="mt-4 max-w-xl space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const input = new FormData(form);
                        const password = String(input.get('password') ?? '');
                        create.mutate(
                            {
                                role,
                                name: String(input.get('name') ?? ''),
                                username: String(input.get('username') ?? ''),
                                ...(password ? { password } : {}),
                            },
                            {
                                onSuccess: (user) => {
                                    setCredentials(
                                        user.generatedPassword
                                            ? [
                                                  {
                                                      username: user.username,
                                                      password:
                                                          user.generatedPassword,
                                                  },
                                              ]
                                            : [],
                                    );
                                    setMessage(
                                        `Akun ${user.username} berhasil dibuat.`,
                                    );
                                    create.reset();
                                    form.reset();
                                },
                            },
                        );
                    }}
                >
                    <FormField
                        name="name"
                        label="Nama lengkap"
                        required
                        error={create.error}
                    />
                    <FormField
                        name="username"
                        label="Nama pengguna"
                        required
                        autoComplete="off"
                        error={create.error}
                    />
                    <FormField
                        name="password"
                        label="Kata sandi (opsional)"
                        type="password"
                        autoComplete="new-password"
                        error={create.error}
                    />
                    <p className="text-muted-foreground text-sm">
                        Kosongkan agar sistem membuat kata sandi. Jika diisi:
                        minimal {role === 'student' ? '8' : '15'} karakter.
                    </p>
                    <RequestError error={create.error} />
                    <Button
                        type="submit"
                        disabled={create.isPending || credentials.length > 0}
                    >
                        {create.isPending ? 'Membuat akun…' : 'Buat akun'}
                    </Button>
                </form>
            </details>
            <details className="border-paper-edge bg-background rounded-2xl border p-5">
                <summary className="focus-visible:outline-ring cursor-pointer py-2 text-lg font-semibold focus-visible:outline-3">
                    Impor akun dari Excel
                </summary>
                <form
                    className="mt-4 max-w-xl space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const file = new FormData(form).get('file');
                        if (!(file instanceof File)) return;
                        upload.mutate(
                            { role, file },
                            {
                                onSuccess: ({ created }) => {
                                    setCredentials(
                                        created.flatMap((user) =>
                                            user.generatedPassword
                                                ? [
                                                      {
                                                          username:
                                                              user.username,
                                                          password:
                                                              user.generatedPassword,
                                                      },
                                                  ]
                                                : [],
                                        ),
                                    );
                                    setMessage(
                                        `${created.length} akun berhasil diimpor.`,
                                    );
                                    upload.reset();
                                    form.reset();
                                },
                            },
                        );
                    }}
                >
                    <p>
                        Satu file untuk satu jenis akun. Maksimal 500 baris dan
                        2 MB. Jika satu baris bermasalah, semua baris belum
                        diimpor.
                    </p>
                    <a
                        href="/account-template.xlsx"
                        download
                        className="text-primary inline-block min-h-12 py-3 underline"
                    >
                        Unduh template Excel
                    </a>
                    <p className="text-sm">
                        Isi kolom Nama dan Username. Password boleh kosong.
                        Mulai dari baris kedua; pertahankan judul kolom.
                    </p>
                    <FormField
                        name="file"
                        label="File Excel (.xlsx)"
                        type="file"
                        accept=".xlsx"
                        required
                        error={upload.error}
                    />
                    <RequestError error={upload.error} />
                    <Button
                        type="submit"
                        disabled={upload.isPending || credentials.length > 0}
                    >
                        {upload.isPending ? 'Mengimpor akun…' : 'Impor akun'}
                    </Button>
                </form>
            </details>
            <p role="status" className="lg:col-span-2">
                {message}
            </p>
        </div>
    );
}
