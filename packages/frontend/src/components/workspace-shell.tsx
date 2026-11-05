import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from './ui/button';

export type WorkspaceLink = {
    to: string;
    label: string;
    current: 'page' | 'within' | false;
    nested?: WorkspaceLink[];
};

const linkStyle =
    'focus-visible:outline-ring hover:bg-muted data-current:bg-secondary data-current:text-primary-deep flex min-h-11 items-center rounded-lg px-3 py-2 font-medium focus-visible:outline-3 data-current:font-semibold';

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
                        {link.label}
                    </Link>
                    {link.nested && link.nested.length > 0 && (
                        <div className="border-paper-edge mt-1 ml-3 border-l pl-2">
                            <WorkspaceLinks links={link.nested} />
                        </div>
                    )}
                </li>
            ))}
        </ul>
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
        <div className="space-y-2">
            <p className="text-muted-foreground px-3 text-sm break-words">
                Masuk sebagai{' '}
                <span className="text-foreground font-medium">{userName}</span>
            </p>
            <WorkspaceLinks
                links={[
                    {
                        to: '/account',
                        label: 'Pengaturan akun',
                        current: onAccount ? 'page' : false,
                    },
                ]}
            />
            <Button
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={onLogout}
            >
                {pending ? 'Keluar…' : 'Keluar'}
            </Button>
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
    const brand = (
        <div>
            <p className="text-primary font-bold">Aku Senang Belajar</p>
            <p className="text-muted-foreground text-sm">{area}</p>
        </div>
    );

    useEffect(() => {
        setOpen(false);
    }, [location.pathname, location.search]);

    return (
        <div className="bg-muted font-workspace text-foreground min-h-screen md:flex">
            <a
                href="#main"
                className="bg-background focus-visible:outline-ring sr-only focus:not-sr-only focus:block focus:p-4 focus-visible:outline-3 focus-visible:-outline-offset-3"
            >
                Langsung ke isi
            </a>
            <aside className="bg-background border-paper-edge hidden w-64 shrink-0 flex-col gap-6 border-r px-3 py-6 md:sticky md:top-0 md:flex md:h-screen">
                <div className="px-3">{brand}</div>
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
                <header className="bg-background border-paper-edge border-b md:hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                        {brand}
                        <Button
                            variant="outline"
                            aria-expanded={open}
                            aria-controls={menuId}
                            onClick={() => setOpen(!open)}
                        >
                            Menu
                        </Button>
                    </div>
                    {open && (
                        <div
                            id={menuId}
                            className="border-paper-edge space-y-4 border-t px-3 py-4"
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
