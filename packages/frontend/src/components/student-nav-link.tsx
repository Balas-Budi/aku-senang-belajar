import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeftIcon, ArrowRightIcon } from './icons/arrow-icon';

const pill =
    'font-display text-primary-deep border-paper-edge hover:bg-student-surface focus-visible:outline-ring inline-flex min-h-11 items-center gap-2 rounded-full border-2 bg-white py-1.5 font-semibold shadow-[0_3px_0_var(--color-paper-edge)] transition-[translate,box-shadow,background-color] duration-100 focus-visible:outline-3 focus-visible:outline-offset-2 active:translate-y-[3px] active:shadow-none';
const badge =
    'bg-secondary text-primary grid size-8 shrink-0 place-items-center rounded-full';

export function StudentNavLink({
    to,
    back = false,
    children,
}: {
    to: string;
    back?: boolean;
    children: ReactNode;
}) {
    return (
        <Link
            to={to}
            className={back ? `${pill} pr-5 pl-1.5` : `${pill} pr-1.5 pl-5`}
        >
            {back && (
                <span className={badge}>
                    <ArrowLeftIcon className="size-4" />
                </span>
            )}
            {children}
            {!back && (
                <span className={badge}>
                    <ArrowRightIcon className="size-4" />
                </span>
            )}
        </Link>
    );
}
