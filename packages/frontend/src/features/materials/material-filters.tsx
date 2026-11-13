import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Material } from './queries';
import { useSubjects } from '../assignments/subject-art';

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
    const { list } = useSubjects();
    const select =
        'border-border focus-visible:outline-ring min-h-12 w-full min-w-0 rounded-xl border bg-white px-3 text-base focus-visible:outline-3';
    return (
        <search
            aria-label="Saring materi"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_14rem_11rem]"
        >
            <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
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
            <div>
                <label htmlFor="material-subject" className="sr-only">
                    Mata pelajaran
                </label>
                <select
                    id="material-subject"
                    value={filters.subject}
                    onChange={(event) =>
                        update({ subject: event.currentTarget.value })
                    }
                    className={select}
                >
                    <option value="">Semua mata pelajaran</option>
                    {list.map((subject) => (
                        <option key={subject.key} value={subject.key}>
                            {subject.name}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="material-grade" className="sr-only">
                    Kelas
                </label>
                <select
                    id="material-grade"
                    value={filters.grade}
                    onChange={(event) =>
                        update({ grade: event.currentTarget.value })
                    }
                    className={select}
                >
                    <option value="">Semua kelas</option>
                    {grades.map((grade) => (
                        <option key={grade} value={grade}>
                            Kelas {grade}
                        </option>
                    ))}
                </select>
            </div>
        </search>
    );
}
