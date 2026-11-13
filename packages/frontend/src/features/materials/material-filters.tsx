import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Material } from './queries';
import { subjects } from '../assignments/subject-art';
import { cn } from '../../lib/cn';

const grades = [1, 2, 3, 4, 5, 6];

type Filters = { text: string; subject: string; grade: string };

/** Filters live in the address so they survive a trip to a material and back. */
export function useMaterialFilters() {
    const [params] = useSearchParams();
    const [filters, setFilters] = useState<Filters>(() => ({
        text: params.get('cari') ?? '',
        subject: params.get('mapel') ?? '',
        grade: params.get('kelas') ?? '',
    }));
    const update = (change: Partial<Filters>) => {
        const next = { ...filters, ...change };
        setFilters(next);
        const url = new URL(window.location.href);
        for (const [key, value] of [
            ['cari', next.text],
            ['mapel', next.subject],
            ['kelas', next.grade],
        ] as const)
            if (value) url.searchParams.set(key, value);
            else url.searchParams.delete(key);
        // Plain replaceState: a router navigation per keystroke would rerun the loaders.
        window.history.replaceState(window.history.state, '', url);
    };
    const text = filters.text.trim().toLocaleLowerCase('id');
    const active = Boolean(text || filters.subject || filters.grade);
    const matches = (material: Material) =>
        (!text || material.title.toLocaleLowerCase('id').includes(text)) &&
        (!filters.subject || material.subject === filters.subject) &&
        (!filters.grade || String(material.grade) === filters.grade);
    return { filters, update, active, matches };
}

export function MaterialFilters({
    filters,
    update,
}: Pick<ReturnType<typeof useMaterialFilters>, 'filters' | 'update'>) {
    const subjectOptions = [
        { value: '', label: 'Semua' },
        ...Object.entries(subjects).map(([value, { label }]) => ({
            value,
            label,
        })),
    ];
    return (
        <search className="space-y-3" aria-label="Saring materi">
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                    <label htmlFor="material-search" className="sr-only">
                        Cari judul materi
                    </label>
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2"
                    >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                    </svg>
                    <input
                        id="material-search"
                        type="search"
                        placeholder="Cari judul materi…"
                        value={filters.text}
                        onChange={(event) =>
                            update({ text: event.currentTarget.value })
                        }
                        className="border-border focus-visible:outline-ring min-h-12 w-full rounded-xl border bg-white pr-3 pl-11 text-base focus-visible:outline-3"
                    />
                </div>
                <label htmlFor="material-grade" className="sr-only">
                    Kelas
                </label>
                <select
                    id="material-grade"
                    value={filters.grade}
                    onChange={(event) =>
                        update({ grade: event.currentTarget.value })
                    }
                    className="border-border focus-visible:outline-ring min-h-12 rounded-xl border bg-white px-3 text-base focus-visible:outline-3 sm:w-44"
                >
                    <option value="">Semua kelas</option>
                    {grades.map((grade) => (
                        <option key={grade} value={grade}>
                            Kelas {grade}
                        </option>
                    ))}
                </select>
            </div>
            <fieldset>
                <legend className="sr-only">Mata pelajaran</legend>
                <div className="flex flex-wrap gap-2">
                    {subjectOptions.map((option) => (
                        <label key={option.value} className="relative">
                            <input
                                type="radio"
                                name="material-subject"
                                value={option.value}
                                checked={filters.subject === option.value}
                                onChange={() =>
                                    update({ subject: option.value })
                                }
                                className="peer absolute inset-0 cursor-pointer opacity-0"
                            />
                            <span
                                className={cn(
                                    'border-border peer-focus-visible:outline-ring flex min-h-11 items-center rounded-full border-2 bg-white px-4 font-semibold peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2',
                                    'peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white',
                                )}
                            >
                                {option.label}
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>
        </search>
    );
}
