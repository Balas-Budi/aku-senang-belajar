import { useState } from 'react';
import { redirect, useNavigate, useSearchParams } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api';
import { safeReturnTo } from '../lib/safe-return-to';
import { meQuery, roleHome, useLogin } from '../features/auth/queries';
import { FormField } from '../components/form-field';
import { RequestError } from '../components/request-error';
import { Button } from '../components/ui/button';
import { PasswordField } from '../features/auth/password-field';
import { Dialog } from '../components/ui/dialog';
import type { Route } from './+types/login';
export async function loader({ request }: Route.LoaderArgs) {
    try {
        const user = await new QueryClient().fetchQuery(
            meQuery(request.headers.get('cookie')),
        );
        throw redirect(roleHome(user.role));
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
    }
}
export const meta = () => [{ title: 'Masuk | Aku Senang Belajar' }];
export default function Login() {
    const login = useLogin();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [forgotPassword, setForgotPassword] = useState(false);
    return (
        <main className="login-page flex min-h-svh items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
            <section
                className="bg-background w-full max-w-[480px] rounded-3xl p-6 shadow-xl sm:p-10"
                aria-labelledby="login-title"
            >
                <header className="mb-8">
                    <h1
                        id="login-title"
                        className="text-primary-deep text-3xl leading-tight font-bold sm:text-[2rem]"
                    >
                        Masuk ke ruangmu
                    </h1>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                        Belajar, mencoba, lalu memahami.
                    </p>
                </header>
                <form
                    className="space-y-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const input = new FormData(event.currentTarget);
                        login.mutate(
                            {
                                username: String(input.get('username') ?? ''),
                                password: String(input.get('password') ?? ''),
                                rememberMe: input.get('rememberMe') === 'on',
                            },
                            {
                                onSuccess: (user) => {
                                    void navigate(
                                        safeReturnTo(
                                            params.get('returnTo'),
                                            roleHome(user.role),
                                        ),
                                        { replace: true },
                                    );
                                },
                            },
                        );
                    }}
                >
                    <FormField
                        name="username"
                        label="Nama pengguna"
                        autoComplete="username"
                        required
                        error={login.error}
                    />
                    <div className="space-y-1">
                        <PasswordField
                            name="password"
                            label="Kata sandi"
                            autoComplete="current-password"
                            required
                            error={login.error}
                        />
                        <div className="flex flex-wrap items-center justify-between gap-x-3">
                            <label className="text-muted-foreground flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    name="rememberMe"
                                    className="accent-primary focus-visible:outline-ring size-4 rounded focus-visible:outline-3 focus-visible:outline-offset-3"
                                />
                                Ingat saya
                            </label>
                            <button
                                type="button"
                                className="text-primary focus-visible:outline-ring min-h-11 rounded px-1 underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2"
                                onClick={() => setForgotPassword(true)}
                            >
                                Lupa kata sandi?
                            </button>
                        </div>
                    </div>
                    <RequestError error={login.error} />
                    <Button
                        type="submit"
                        disabled={login.isPending}
                        className="mt-2 w-full"
                    >
                        {login.isPending ? 'Sedang masuk…' : 'Masuk'}
                    </Button>
                </form>
                <Dialog
                    open={forgotPassword}
                    onClose={() => setForgotPassword(false)}
                    aria-labelledby="forgot-password-title"
                >
                    <h2
                        id="forgot-password-title"
                        className="text-primary-deep text-2xl font-bold"
                    >
                        Lupa kata sandi?
                    </h2>
                    <p className="mt-4 leading-relaxed">
                        Minta bantuan guru atau admin sekolah. Admin akan
                        mereset kata sandimu dan memberikan kata sandi acak yang
                        baru.
                    </p>
                    <p className="mt-3 leading-relaxed">
                        Setelah masuk, buka Ganti kata sandi untuk membuat kata
                        sandimu sendiri.
                    </p>
                    <Button
                        className="mt-6 w-full"
                        onClick={() => setForgotPassword(false)}
                    >
                        Kembali ke login
                    </Button>
                </Dialog>
            </section>
        </main>
    );
}
