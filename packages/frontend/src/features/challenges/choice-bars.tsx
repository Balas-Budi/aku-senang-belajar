import type { ChallengeCount, ChallengeOption } from './queries';

export const optionLabel = (options: ChallengeOption[], id: string) =>
    options.find((option) => option.id === id)?.label ?? id;

export function ChoiceBars({
    options,
    counts,
    own,
    ownLabel,
}: {
    options: ChallengeOption[];
    counts: ChallengeCount[];
    own?: string;
    ownLabel?: string;
}) {
    const total = counts.reduce((sum, { count }) => sum + count, 0);
    return (
        <ul className="space-y-3">
            {options.map((option) => {
                const count =
                    counts.find(({ id }) => id === option.id)?.count ?? 0;
                return (
                    <li key={option.id}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <span className="min-w-0 font-semibold break-words">
                                {option.label}
                                {own === option.id && (
                                    <>
                                        {' '}
                                        <span className="bg-student-accent-soft text-student-accent-ink rounded-lg px-2 py-0.5 text-[0.85em] font-bold whitespace-nowrap">
                                            {ownLabel}
                                        </span>
                                    </>
                                )}
                            </span>
                            <span className="tabular-nums">
                                {count} jawaban
                            </span>
                        </div>
                        <div
                            aria-hidden="true"
                            className="bg-secondary mt-1 h-4 overflow-hidden rounded-full"
                        >
                            <div
                                className="bg-primary h-full rounded-full"
                                style={{
                                    width: `${total ? (count / total) * 100 : 0}%`,
                                }}
                            />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
