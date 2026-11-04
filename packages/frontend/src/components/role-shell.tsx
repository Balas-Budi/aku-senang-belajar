import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { meQuery, useLogout, type Role } from '../features/auth/queries';
import { Button } from './ui/button';
import { ToastProvider } from './ui/toast';
import { RequestError } from './request-error';
import { StudentShell } from '../features/student/student-shell';
export function RoleShell({ role }: { role: Role }) {
    const query = useQuery(meQuery());
    const logout = useLogout();
    const navigate = useNavigate();
    const [help, setHelp] = useState(false);
    const student = role === 'student';
    const user = query.data;
    if (!user)
        return (
            <main className="mx-auto max-w-xl space-y-4 p-8">
                {query.isError ? (
                    <>
                        <RequestError error={query.error} />
                        <Button
                            onClick={() => {
                                void query.refetch();
                            }}
                        >
                            Muat ulang akun
                        </Button>
                    </>
                ) : (
                    <p role="status">Memuat ruangmu…</p>
                )}
            </main>
        );
    if (student)
        return (
            <ToastProvider>
                <StudentShell
                    name={user.name}
                    pending={logout.isPending}
                    error={logout.error}
                    onLogout={() =>
                        logout.mutate(undefined, {
                            onSuccess: () => {
                                void navigate('/login', { replace: true });
                            },
                        })
                    }
                >
                    <Outlet />
                </StudentShell>
            </ToastProvider>
        );
    return (
        <div
            className={
                student
                    ? 'bg-muted min-h-screen text-lg'
                    : 'bg-background min-h-screen'
            }
        >
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:block focus:p-4"
            >
                Langsung ke isi
            </a>
            <header className="border-border bg-background border-b">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-8">
                    <div>
                        <p className="text-primary font-bold">
                            Aku Senang Belajar
                        </p>
                        <p className="text-muted-foreground text-sm">
                            {student
                                ? 'Ruang belajarmu'
                                : role === 'teacher'
                                  ? 'Ruang guru · Kelas'
                                  : 'Administrasi · Akun sekolah'}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="break-all">{user.name}</span>
                        <Link
                            to="/account"
                            className="text-primary focus-visible:outline-ring min-h-11 rounded px-2 py-3 underline underline-offset-4 focus-visible:outline-3"
                        >
                            Pengaturan akun
                        </Link>
                        <Button
                            variant="outline"
                            disabled={logout.isPending}
                            onClick={() =>
                                logout.mutate(undefined, {
                                    onSuccess: () => {
                                        void navigate('/login', {
                                            replace: true,
                                        });
                                    },
                                })
                            }
                        >
                            {logout.isPending ? 'Keluar…' : 'Keluar'}
                        </Button>
                    </div>
                </div>
            </header>
            <main
                id="main"
                className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8"
            >
                <RequestError error={logout.error} />
                <Outlet />
                <footer className="border-border text-muted-foreground border-t pt-6 text-base">
                    <button
                        type="button"
                        className="focus-visible:outline-ring min-h-12 underline underline-offset-4 focus-visible:outline-3"
                        aria-expanded={help}
                        onClick={() => setHelp(!help)}
                    >
                        Butuh bantuan akun?
                    </button>
                    {help && (
                        <p className="mt-2">
                            Minta bantuan admin sekolah untuk membuat akun atau
                            mengatur ulang kata sandi.
                        </p>
                    )}
                </footer>
            </main>
        </div>
    );
}
