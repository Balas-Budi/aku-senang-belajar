import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
export function Sticker({
    tint,
    className,
    children,
}: {
    tint: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex shrink-0 items-center justify-center rounded-2xl',
                tint,
                className,
            )}
        >
            <svg
                viewBox="0 0 48 48"
                fill="none"
                stroke="var(--color-primary-deep)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-[72%]"
            >
                {children}
            </svg>
        </span>
    );
}
