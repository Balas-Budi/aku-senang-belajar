import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeftIcon } from './icons/arrow-icon';

/** Workspace "Kembali ke …" link: a quiet pill, never a bare underline. */
export function BackLink({
    to,
    children,
}: {
    to: string;
    children: ReactNode;
}) {
    return (
        <Link
            to={to}
            className="border-paper-edge text-primary-deep hover:border-primary focus-visible:outline-ring inline-flex min-h-11 items-center gap-2 rounded-full border bg-white py-1.5 pr-4 pl-1.5 text-base font-semibold transition-colors focus-visible:outline-3 print:hidden"
        >
            <span className="bg-secondary text-primary grid size-8 place-items-center rounded-full">
                <ArrowLeftIcon className="size-4" />
            </span>
            {children}
        </Link>
    );
}
