import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { LogoMark } from './logo-mark';
import { CloseIcon } from './icons/close-icon';
import { LogoutIcon, MenuIcon, SettingsIcon } from './icons/workspace-icons';

export type WorkspaceLink = {
    to: string;
    label: string;
    icon?: ReactNode;
    current: 'page' | 'within' | false;
    nested?: WorkspaceLink[];
};

const linkStyle =
    'focus-visible:outline-white flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-base font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-3 data-current:bg-white data-current:font-semibold data-current:text-primary-deep';

function WorkspaceLinks({ links }: { links: WorkspaceLink[] }) {
    return (
        <ul className="space-y-1">
            {links.map((link) => (
                <li key={link.to}>
                    <Link
                        to={link.to}
                        aria-current={
                            link.current === 'page'
                                ? 'page'
                                : link.current === 'within'
                                  ? 'true'
                                  : undefined
                        }
                        data-current={link.current ? '' : undefined}
                        className={linkStyle}
                    >
                        {link.icon}
                        <span className="min-w-0 break-words">
                            {link.label}
                        </span>
                    </Link>
                    {link.nested && link.nested.length > 0 && (
                        <div className="mt-1 ml-5 border-l-2 border-white/20 pl-2">
                            <WorkspaceLinks links={link.nested} />
                        </div>
                    )}
                </li>
            ))}
        </ul>
    );
}

function Brand({ area }: { area: string }) {
    return (
        <Link
            to="/"
            className="flex items-center gap-3 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white">
                <LogoMark className="size-10" />
            </span>
            <span className="min-w-0">
                <span className="font-display block text-lg leading-tight font-semibold text-white">
                    Aku Senang Belajar
                </span>
                <span className="block text-sm text-white/75">{area}</span>
            </span>
        </Link>
    );
}

function AccountBlock({
    userName,
    onAccount,
    pending,
    onLogout,
}: {
    userName: string;
    onAccount: boolean;
    pending: boolean;
    onLogout: () => void;
}) {
    return (
        <div className="space-y-2 border-t border-white/15 pt-4">
            <div className="flex items-center gap-3 px-3 pb-1">
                <span
                    aria-hidden="true"
                    className="font-display flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-semibold text-white"
                >
                    {userName.trim().charAt(0).toUpperCase()}
                </span>
                <p className="min-w-0 text-sm break-words text-white/75">
                    Masuk sebagai
                    <span className="block text-base font-semibold text-white">
                        {userName}
                    </span>
                </p>
            </div>
            <WorkspaceLinks
                links={[
                    {
                        to: '/account',
                        label: 'Pengaturan akun',
                        icon: <SettingsIcon />,
                        current: onAccount ? 'page' : false,
                    },
                ]}
            />
            <button
                type="button"
                disabled={pending}
                onClick={onLogout}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-base font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-3 focus-visible:outline-white disabled:opacity-60"
            >
                <LogoutIcon />
                {pending ? 'Keluar…' : 'Keluar'}
            </button>
        </div>
    );
}

export function WorkspaceShell({
    area,
    links,
    userName,
    pending,
    onLogout,
    children,
}: {
    area: string;
    links: WorkspaceLink[];
    userName: string;
    pending: boolean;
    onLogout: () => void;
    children: ReactNode;
}) {
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const menuId = useId();
    const onAccount = location.pathname.startsWith('/account');

    useEffect(() => {
        setOpen(false);
    }, [location.pathname, location.search]);

    return (
        <div className="workspace font-workspace text-foreground min-h-svh md:flex">
            <a
                href="#main"
                className="bg-background focus-visible:outline-ring sr-only focus:not-sr-only focus:block focus:p-4 focus-visible:outline-3 focus-visible:-outline-offset-3"
            >
                Langsung ke isi
            </a>
            <aside className="bg-primary-deep hidden w-72 shrink-0 flex-col gap-8 px-4 py-6 md:sticky md:top-0 md:flex md:h-svh print:hidden">
                <div className="px-1">
                    <Brand area={area} />
                </div>
                <nav
                    aria-label="Navigasi utama"
                    className="flex-1 overflow-y-auto"
                >
                    <WorkspaceLinks links={links} />
                </nav>
                <AccountBlock
                    userName={userName}
                    onAccount={onAccount}
                    pending={pending}
                    onLogout={onLogout}
                />
            </aside>
            <div className="min-w-0 flex-1">
                <header className="bg-primary-deep md:hidden print:hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <Brand area={area} />
                        <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={menuId}
                            onClick={() => setOpen(!open)}
                            className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl border-2 border-white/40 px-4 font-semibold text-white hover:bg-white/10 focus-visible:outline-3 focus-visible:outline-white"
                        >
                            {open ? <CloseIcon /> : <MenuIcon />}
                            Menu
                        </button>
                    </div>
                    {open && (
                        <div
                            id={menuId}
                            className="space-y-4 border-t border-white/15 px-4 py-4"
                        >
                            <nav aria-label="Navigasi utama">
                                <WorkspaceLinks links={links} />
                            </nav>
                            <AccountBlock
                                userName={userName}
                                onAccount={onAccount}
                                pending={pending}
                                onLogout={onLogout}
                            />
                        </div>
                    )}
                </header>
                <main
                    id="main"
                    className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-8"
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
