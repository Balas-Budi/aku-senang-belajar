import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { cn } from '../lib/cn';

export type SectionTab = {
    key: string;
    label: string;
    icon?: ReactNode;
    badge?: string | null;
};

/**
 * Splits a long page into parts kept in the address (`?bagian=`), so the
 * browser's back button and shared links land on the same part.
 */
export function useSection(tabs: SectionTab[]) {
    const [params] = useSearchParams();
    const wanted = params.get('bagian');
    return tabs.find(({ key }) => key === wanted)?.key ?? tabs[0].key;
}

export function SectionTabs({
    label,
    tabs,
    current,
}: {
    label: string;
    tabs: SectionTab[];
    current: string;
}) {
    return (
        <nav aria-label={label}>
            <ul className="border-paper-edge grid grid-cols-2 gap-1 rounded-2xl border bg-white p-1.5 shadow-[0_1px_2px_rgb(28_22_96/0.05)] sm:flex">
                {tabs.map((tab) => {
                    const active = tab.key === current;
                    return (
                        <li key={tab.key} className="min-w-0 sm:flex-1">
                            <Link
                                to={{ search: `?bagian=${tab.key}` }}
                                preventScrollReset
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'focus-visible:outline-ring flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-2 text-center text-base leading-tight font-semibold transition-colors focus-visible:outline-3 sm:px-4',
                                    active
                                        ? 'bg-primary-deep text-white'
                                        : 'text-primary-deep hover:bg-student-surface',
                                )}
                            >
                                {tab.icon}
                                {tab.label}
                                {tab.badge && (
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.5 text-sm',
                                            active
                                                ? 'bg-white/20 text-white'
                                                : 'bg-secondary text-primary-deep',
                                        )}
                                    >
                                        {tab.badge}
                                    </span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
