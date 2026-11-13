import { useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from './icons/arrow-icon';
import { Button } from './ui/button';

/** Slices a list into pages; the page shown stays valid when the list shrinks. */
export function usePages<T>(items: T[], size: number) {
    const [wanted, setPage] = useState(0);
    const pages = Math.max(1, Math.ceil(items.length / size));
    const page = Math.min(wanted, pages - 1);
    return {
        page,
        pages,
        setPage,
        shown: items.slice(page * size, (page + 1) * size),
    };
}

export function Pager({
    label,
    page,
    pages,
    onPage,
}: {
    label: string;
    page: number;
    pages: number;
    onPage: (page: number) => void;
}) {
    if (pages <= 1) return null;
    return (
        <nav
            aria-label={label}
            className="flex flex-wrap items-center justify-between gap-3"
        >
            <p className="text-muted-foreground text-base" aria-live="polite">
                Halaman {page + 1} dari {pages}
            </p>
            <span className="flex gap-2">
                <Button
                    variant="outline"
                    className="min-h-11 bg-white px-4"
                    disabled={page === 0}
                    onClick={() => onPage(page - 1)}
                >
                    <ArrowLeftIcon className="size-4" />
                    Sebelumnya
                </Button>
                <Button
                    variant="outline"
                    className="min-h-11 bg-white px-4"
                    disabled={page === pages - 1}
                    onClick={() => onPage(page + 1)}
                >
                    Berikutnya
                    <ArrowRightIcon className="size-4" />
                </Button>
            </span>
        </nav>
    );
}
