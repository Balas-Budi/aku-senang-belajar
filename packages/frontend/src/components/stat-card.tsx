import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Card } from './ui/card';

export function StatGrid({ children }: { children: ReactNode }) {
    return (
        <div className="@container">
            <ul className="grid gap-4 @2xl:grid-cols-3">{children}</ul>
        </div>
    );
}

export function StatCard({
    label,
    value,
    note,
    to,
    action,
}: {
    label: string;
    value: number;
    note: string;
    to?: string;
    action?: string;
}) {
    const body = (
        <>
            <p className="text-muted-foreground text-sm font-medium">{label}</p>
            <p className="mt-1 text-[2rem] leading-tight font-bold tabular-nums">
                {value}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{note}</p>
            {to && action && (
                <p className="text-primary mt-2 text-sm font-medium underline underline-offset-4">
                    {action}
                </p>
            )}
        </>
    );

    if (!to) return <Card className="h-full">{body}</Card>;

    return (
        <Link
            to={to}
            className="focus-visible:outline-ring block h-full rounded-2xl focus-visible:outline-3"
        >
            <Card className="hover:border-primary h-full transition-colors">
                {body}
            </Card>
        </Link>
    );
}
