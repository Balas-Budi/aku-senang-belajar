import { useRef, useState } from 'react';
import { redirect, useNavigate, useSearchParams } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api';
import { safeReturnTo } from '../lib/safe-return-to';
import { meQuery, roleHome, useLogin } from '../features/auth/queries';
import { GreetingJalak } from '../features/auth/greeting-jalak';
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
    const [field, setField] = useState<'username' | 'password' | null>(null);
    const usernameInput = useRef<HTMLInputElement>(null);
    return (
        <main className="login-page font-rounded flex min-h-svh items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
            <div className="grid w-full max-w-4xl items-center gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,440px)] md:gap-10">
                <div className="flex flex-col items-center md:items-start">
                    <GreetingJalak
                        greeting="Cuit! Halo, selamat datang."
                        lookAt={usernameInput}
                        watching={field === 'username'}
                        covering={field === 'password'}
                        bubbleClassName="bottom-[88%] left-1/2 -translate-x-1/2 md:bottom-[74%] md:left-[70%] md:translate-x-0"
                        className="w-28 sm:w-36 md:w-60"
                    />
                    <p className="font-display text-primary-deep mt-6 hidden text-4xl leading-tight font-semibold md:block">
                        Aku Senang Belajar
                    </p>
                    <p className="text-muted-foreground mt-2 hidden max-w-sm text-xl leading-relaxed md:block">
                        Belajar, mencoba, lalu memahami.
                    </p>
                </div>
                <section
                    className="border-paper-edge w-full rounded-[28px] border-2 border-b-[6px] bg-white p-6 sm:p-10"
                    aria-labelledby="login-title"
                >
                    <header className="mb-8">
                        <h1
                            id="login-title"
                            className="font-display text-primary-deep text-3xl leading-tight font-semibold sm:text-4xl"
                        >
                            Masuk ke ruangmu
                        </h1>
                        <p className="text-muted-foreground mt-3 leading-relaxed md:hidden">
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
                                    username: String(
                                        input.get('username') ?? '',
                                    ),
                                    password: String(
                                        input.get('password') ?? '',
                                    ),
                                    rememberMe:
                                        input.get('rememberMe') === 'on',
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
                            ref={usernameInput}
                            feel="chunky"
                            name="username"
                            label="Nama pengguna"
                            autoComplete="username"
                            required
                            error={login.error}
                            onFocus={() => setField('username')}
                            onBlur={() => setField(null)}
                        />
                        <div className="space-y-1">
                            <PasswordField
                                feel="chunky"
                                name="password"
                                label="Kata sandi"
                                autoComplete="current-password"
                                required
                                error={login.error}
                                onFocus={() => setField('password')}
                                onBlur={() => setField(null)}
                            />
                            <div className="flex flex-wrap items-center justify-between gap-x-3">
                                <label className="text-muted-foreground flex min-h-11 cursor-pointer items-center gap-2 text-base">
                                    <input
                                        type="checkbox"
                                        name="rememberMe"
                                        className="accent-primary focus-visible:outline-ring size-5 rounded focus-visible:outline-3 focus-visible:outline-offset-3"
                                    />
                                    Ingat saya
                                </label>
                                <button
                                    type="button"
                                    className="text-primary focus-visible:outline-ring min-h-11 rounded px-1 text-base font-semibold underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2"
                                    onClick={() => setForgotPassword(true)}
                                >
                                    Lupa kata sandi?
                                </button>
                            </div>
                        </div>
                        <RequestError error={login.error} />
                        <Button
                            type="submit"
                            feel="chunky"
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
                        className="border-paper-edge border-2"
                    >
                        <h2
                            id="forgot-password-title"
                            className="font-display text-primary-deep text-3xl font-semibold"
                        >
                            Lupa kata sandi?
                        </h2>
                        <p className="mt-4 leading-relaxed">
                            Minta bantuan guru atau admin sekolah. Admin akan
                            mereset kata sandimu dan memberikan kata sandi acak
                            yang baru.
                        </p>
                        <p className="mt-3 leading-relaxed">
                            Setelah masuk, buka Ganti kata sandi untuk membuat
                            kata sandimu sendiri.
                        </p>
                        <Button
                            feel="chunky"
                            className="mt-6 w-full"
                            onClick={() => setForgotPassword(false)}
                        >
                            Kembali ke login
                        </Button>
                    </Dialog>
                </section>
            </div>
        </main>
    );
}
