import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export function SectionTitle({
    id,
    icon,
    children,
    className,
}: {
    id?: string;
    icon?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex items-center gap-3', className)}>
            {icon && (
                <span
                    aria-hidden="true"
                    className="bg-secondary text-primary-deep flex size-11 shrink-0 items-center justify-center rounded-xl"
                >
                    {icon}
                </span>
            )}
            <h2
                id={id}
                className="font-display text-primary-deep text-xl leading-tight font-semibold break-words sm:text-2xl"
            >
                {children}
            </h2>
        </div>
    );
}
