import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../lib/cn';

export type StatTone = 'attention' | 'ai' | 'waiting' | 'calm';

const tones: Record<StatTone, { tile: string; card: string }> = {
    attention: {
        tile: 'bg-status-verify-soft text-status-verify',
        card: 'border-status-verify/25',
    },
    ai: {
        tile: 'bg-secondary text-ai-suggestion',
        card: 'border-ai-suggestion/20',
    },
    waiting: {
        tile: 'bg-activity-blue/12 text-[#00609a]',
        card: 'border-activity-blue/25',
    },
    calm: {
        tile: 'bg-student-surface text-primary-deep',
        card: 'border-paper-edge',
    },
};

export function StatGrid({ children }: { children: ReactNode }) {
    return (
        <div className="@container">
            <ul className="grid grid-cols-3 gap-3 @2xl:gap-4">{children}</ul>
        </div>
    );
}

export function StatCard({
    label,
    value,
    note,
    icon,
    tone = 'calm',
    to,
    action,
}: {
    label: string;
    value: number;
    note: string;
    icon?: ReactNode;
    tone?: StatTone;
    to?: string;
    action?: string;
}) {
    const style = tones[tone];
    const body = (
        <>
            <span className="flex items-start justify-between gap-2">
                <span className="font-display text-primary-deep text-[2rem] leading-none font-semibold tabular-nums @2xl:text-[2.5rem]">
                    {value}
                </span>
                {icon && (
                    <span
                        aria-hidden="true"
                        className={cn(
                            'hidden size-11 shrink-0 items-center justify-center rounded-xl @md:flex',
                            style.tile,
                        )}
                    >
                        {icon}
                    </span>
                )}
            </span>
            <span className="mt-2 block text-base leading-snug font-semibold">
                {label}
            </span>
            <span className="text-muted-foreground mt-1 hidden text-sm leading-snug @2xl:block">
                {note}
            </span>
            {to && action && (
                <span className="text-primary mt-2 hidden text-sm font-semibold @2xl:block">
                    {action} →
                </span>
            )}
        </>
    );
    const card = cn(
        'bg-background flex h-full flex-col rounded-[20px] border-2 p-3 shadow-[0_1px_2px_rgb(28_22_96/0.05)] @2xl:p-5',
        style.card,
    );

    if (!to) return <div className={card}>{body}</div>;

    return (
        <Link
            to={to}
            className={cn(
                card,
                'focus-visible:outline-ring hover:border-primary transition-colors focus-visible:outline-3 focus-visible:outline-offset-2',
            )}
        >
            {body}
        </Link>
    );
}
