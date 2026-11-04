import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LogoutDialog } from './logout-dialog';
import { Link } from 'react-router';
import { Button } from '../../components/ui/button';
import { useErrorToast } from '../../components/ui/toast';
import { requestErrorMessage } from '../../components/request-error';
export function StudentShell({
    name,
    children,
    onLogout,
    pending,
    error,
}: {
    name: string;
    children: ReactNode;
    onLogout: () => void;
    pending: boolean;
    error: unknown;
}) {
    const [confirmLogout, setConfirmLogout] = useState(false);
    const menu = useRef<HTMLDetailsElement>(null);
    const showError = useErrorToast();
    useEffect(() => {
        if (!error) return;
        setConfirmLogout(false);
        showError(requestErrorMessage(error));
    }, [error, showError]);
    useEffect(() => {
        function closeOutside(event: PointerEvent) {
            const details = menu.current;
            if (
                details?.open &&
                event.target instanceof Node &&
                !details.contains(event.target)
            )
                details.open = false;
        }
        function closeOnEscape(event: KeyboardEvent) {
            const details = menu.current;
            if (event.key !== 'Escape' || !details?.open) return;
            details.open = false;
            details.querySelector('summary')?.focus();
        }
        document.addEventListener('pointerdown', closeOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, []);
    return (
        <div className="student-space min-h-svh text-lg">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:block focus:p-4"
            >
                Langsung ke isi
            </a>
            <header className="border-primary/10 border-b bg-white">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
                    <Link
                        to="/student"
                        className="text-primary-deep focus-visible:outline-ring rounded-lg text-lg leading-tight font-extrabold focus-visible:outline-3"
                    >
                        Aku Senang Belajar
                    </Link>
                    <details ref={menu} className="group relative shrink-0">
                        <summary className="border-primary/15 text-primary-deep hover:bg-student-surface focus-visible:outline-ring flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-xl border bg-white py-1.5 pr-3 pl-1.5 font-bold transition-colors focus-visible:outline-3 [&::-webkit-details-marker]:hidden">
                            <span
                                aria-hidden="true"
                                className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-full text-base"
                            >
                                {name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="sr-only">Akun</span>
                            <span className="max-w-32 truncate text-base">
                                {name.split(' ')[0]}
                            </span>
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 20 20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="block size-4 shrink-0 self-center transition-transform duration-150 group-open:rotate-180"
                            >
                                <path
                                    d="m5 8 5 5 5-5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </summary>
                        <div className="student-menu border-primary/15 absolute right-0 z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] space-y-3 rounded-2xl border bg-white p-4 shadow-lg">
                            <p className="text-primary-deep text-base font-bold break-words">
                                {name}
                            </p>
                            <Button
                                variant="destructive"
                                className="w-full"
                                disabled={pending}
                                onClick={() => {
                                    if (menu.current) menu.current.open = false;
                                    setConfirmLogout(true);
                                }}
                            >
                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="size-5"
                                >
                                    <path d="M10 4H4v16h6m4-12 4 4-4 4m-5-4h13" />
                                </svg>
                                Keluar dari akun
                            </Button>
                        </div>
                    </details>
                </div>
            </header>
            <main
                id="main"
                className="mx-auto max-w-5xl space-y-6 px-4 py-7 sm:px-8 sm:py-10"
            >
                {children}
            </main>
            <LogoutDialog
                open={confirmLogout}
                onClose={() => {
                    if (!pending) setConfirmLogout(false);
                }}
                onConfirm={onLogout}
                pending={pending}
            />
        </div>
    );
}
