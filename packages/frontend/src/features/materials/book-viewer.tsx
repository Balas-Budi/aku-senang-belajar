import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';

type Chapter = { id: number; title: string; firstPage: number | null };

type Loaded =
    | { state: 'loading'; percent: number | null }
    | { state: 'failed' }
    | { state: 'ready'; doc: PDFDocumentProxy };

/** pdf.js is heavy, so it loads only when the Buku tab opens. */
async function openBook(url: string, onPercent: (value: number) => void) {
    const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({
        url,
        withCredentials: true,
        disableRange: true,
    });
    task.onProgress = ({
        loaded,
        total,
    }: {
        loaded: number;
        total: number;
    }) => {
        if (total > 0)
            onPercent(Math.min(99, Math.round((loaded / total) * 100)));
    };
    return { task, doc: task.promise };
}

function useScreen() {
    const [screen, setScreen] = useState({ wide: false, height: 900 });
    useEffect(() => {
        const query = window.matchMedia('(min-width: 1024px)');
        const change = () =>
            setScreen({ wide: query.matches, height: window.innerHeight });
        change();
        query.addEventListener('change', change);
        window.addEventListener('resize', change);
        return () => {
            query.removeEventListener('change', change);
            window.removeEventListener('resize', change);
        };
    }, []);
    return screen;
}

function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) =>
            setWidth(Math.floor(entry.contentRect.width)),
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
}

function PageCanvas({
    doc,
    number,
    width,
}: {
    doc: PDFDocumentProxy;
    number: number;
    width: number;
}) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [ratio, setRatio] = useState<number | null>(null);
    useEffect(() => {
        let cancelled = false;
        let task: RenderTask | null = null;
        void doc.getPage(number).then((page) => {
            if (cancelled || !canvas.current || width === 0) return;
            const base = page.getViewport({ scale: 1 });
            const scale = width / base.width;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const viewport = page.getViewport({ scale: scale * dpr });
            const element = canvas.current;
            element.width = Math.floor(viewport.width);
            element.height = Math.floor(viewport.height);
            setRatio(base.height / base.width);
            task = page.render({ canvas: element, viewport });
            task.promise.catch(() => undefined);
        });
        return () => {
            cancelled = true;
            task?.cancel();
        };
    }, [doc, number, width]);
    return (
        <div
            className="relative bg-white"
            style={{ aspectRatio: ratio ? `1 / ${ratio}` : '1 / 1.414' }}
        >
            <canvas
                ref={canvas}
                role="img"
                aria-label={`Halaman ${number}`}
                className="absolute inset-0 size-full"
            />
        </div>
    );
}

function Arrow({ back }: { back?: boolean }) {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6"
        >
            <path d={back ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
        </svg>
    );
}

/** In a two-page spread the cover stands alone, then even pages sit left like a printed book. */
function spreadStart(page: number, wide: boolean) {
    if (!wide || page === 1) return page;
    return page % 2 === 0 ? page : page - 1;
}

export function BookViewer({
    url,
    pageCount,
    chapters,
}: {
    url: string;
    pageCount: number;
    chapters: Chapter[];
}) {
    const { wide, height } = useScreen();
    const [loaded, setLoaded] = useState<Loaded>({
        state: 'loading',
        percent: null,
    });
    const [attempt, setAttempt] = useState(0);
    const [page, setPage] = useState(1);
    const [direction, setDirection] = useState<'next' | 'back'>('next');
    const [frame, width] = useWidth<HTMLDivElement>();
    const touch = useRef<number | null>(null);

    useEffect(() => {
        let alive = true;
        let destroy: (() => void) | null = null;
        setLoaded({ state: 'loading', percent: null });
        openBook(url, (percent) => {
            if (alive) setLoaded({ state: 'loading', percent });
        })
            .then(({ task, doc }) => {
                destroy = () => void task.destroy();
                if (!alive) destroy();
                return doc;
            })
            .then((doc) => {
                if (alive) setLoaded({ state: 'ready', doc });
            })
            .catch(() => {
                if (alive) setLoaded({ state: 'failed' });
            });
        return () => {
            alive = false;
            destroy?.();
        };
    }, [url, attempt]);

    const total =
        loaded.state === 'ready' ? loaded.doc.numPages : Math.max(pageCount, 1);
    const start = spreadStart(page, wide);
    const shown =
        wide && start !== 1 && start + 1 <= total
            ? [start, start + 1]
            : [start];
    const last = shown[shown.length - 1];

    const go = (target: number) => {
        const next = Math.min(Math.max(1, target), total);
        if (spreadStart(next, wide) === start) return;
        setDirection(next > start ? 'next' : 'back');
        setPage(next);
    };
    const forward = () => go(last + 1);
    const backward = () => go(wide && start > 2 ? start - 2 : start - 1);

    const jump = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const value = Number(new FormData(event.currentTarget).get('page'));
        if (Number.isInteger(value) && value > 0) go(value);
    };

    if (loaded.state === 'failed')
        return (
            <div className="space-y-3 py-6 text-center">
                <p className="text-lg font-semibold">Buku belum bisa dibuka.</p>
                <Button onClick={() => setAttempt((value) => value + 1)}>
                    Coba lagi
                </Button>
            </div>
        );

    // Keep a whole page in view: A4-ish pages are about 1.414 times as tall as wide.
    const tallest = Math.max(320, Math.floor((height - 160) / 1.414));
    const pageWidth = Math.min(
        wide ? Math.floor((width - 8) / 2) : width,
        tallest,
    );
    const label =
        shown.length === 2
            ? `Halaman ${shown[0]}–${shown[1]} dari ${total}`
            : `Halaman ${shown[0]} dari ${total}`;
    const usable = chapters
        .filter((chapter) => chapter.firstPage !== null)
        .sort((a, b) => (a.firstPage ?? 0) - (b.firstPage ?? 0));

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                {usable.length > 0 && (
                    <div className="min-w-0 flex-1 space-y-1">
                        <label
                            htmlFor="book-chapter"
                            className="block text-sm font-medium"
                        >
                            Loncat ke bab
                        </label>
                        <select
                            id="book-chapter"
                            value=""
                            onChange={(event) => {
                                const target = Number(
                                    event.currentTarget.value,
                                );
                                if (target) go(target);
                            }}
                            className="border-border focus-visible:outline-ring min-h-12 w-full rounded-xl border bg-white px-3 focus-visible:outline-3"
                        >
                            <option value="" disabled>
                                Pilih bab
                            </option>
                            {usable.map((chapter, index) => (
                                <option
                                    key={chapter.id}
                                    value={chapter.firstPage ?? 1}
                                >
                                    {index + 1}. {chapter.title} (hal.{' '}
                                    {chapter.firstPage})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                <form onSubmit={jump} className="flex items-end gap-2">
                    <div className="space-y-1">
                        <label
                            htmlFor="book-page"
                            className="block text-sm font-medium"
                        >
                            Ke halaman
                        </label>
                        <input
                            id="book-page"
                            name="page"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={total}
                            placeholder={String(page)}
                            className="border-border focus-visible:outline-ring min-h-12 w-24 rounded-xl border bg-white px-3 focus-visible:outline-3"
                        />
                    </div>
                    <Button type="submit" variant="outline" className="px-4">
                        Buka
                    </Button>
                </form>
            </div>

            <section
                aria-roledescription="buku"
                aria-label="Buku"
                tabIndex={0}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowRight') {
                        event.preventDefault();
                        forward();
                    }
                    if (event.key === 'ArrowLeft') {
                        event.preventDefault();
                        backward();
                    }
                }}
                onTouchStart={(event) => {
                    touch.current = event.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(event) => {
                    const from = touch.current;
                    const to = event.changedTouches[0]?.clientX;
                    touch.current = null;
                    if (from === null || to === undefined) return;
                    if (to - from < -50) forward();
                    if (to - from > 50) backward();
                }}
                className="bg-secondary/60 focus-visible:outline-ring relative rounded-2xl p-3 focus-visible:outline-3 sm:p-5"
            >
                <div ref={frame} className="mx-auto w-full">
                    {loaded.state === 'loading' ? (
                        <div
                            role="status"
                            className="flex aspect-[1/1.2] flex-col items-center justify-center gap-3 lg:aspect-[2/1.414]"
                        >
                            <p className="text-lg font-semibold">
                                Memuat buku…
                                {loaded.percent !== null &&
                                    ` ${loaded.percent}%`}
                            </p>
                            <span
                                aria-hidden="true"
                                className="bg-background block h-2 w-48 overflow-hidden rounded-full"
                            >
                                <span
                                    className="bg-primary block h-full rounded-full transition-[width]"
                                    style={{
                                        width: `${loaded.percent ?? 5}%`,
                                    }}
                                />
                            </span>
                        </div>
                    ) : (
                        <div
                            key={start}
                            className={cn(
                                'mx-auto flex justify-center gap-2 motion-safe:animate-[book-turn-next_.28s_ease-out]',
                                direction === 'back' &&
                                    'motion-safe:animate-[book-turn-back_.28s_ease-out]',
                            )}
                            style={{
                                maxWidth: pageWidth * shown.length + 8,
                            }}
                        >
                            {shown.map((number, index) => (
                                <div
                                    key={number}
                                    className={cn(
                                        'min-w-0 flex-1 overflow-hidden shadow-[0_2px_10px_rgb(28_22_96/0.18)]',
                                        shown.length === 2
                                            ? index === 0
                                                ? 'rounded-l-md'
                                                : 'rounded-r-md'
                                            : 'rounded-md',
                                    )}
                                >
                                    <PageCanvas
                                        doc={loaded.doc}
                                        number={number}
                                        width={pageWidth}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <div className="flex items-center justify-between gap-3">
                <Button
                    variant="outline"
                    aria-label="Halaman sebelumnya"
                    disabled={loaded.state !== 'ready' || start === 1}
                    onClick={backward}
                    className="size-14 rounded-full bg-white p-0"
                >
                    <Arrow back />
                </Button>
                <p
                    aria-live="polite"
                    className="text-center font-semibold tabular-nums"
                >
                    {label}
                </p>
                <Button
                    aria-label="Halaman berikutnya"
                    disabled={loaded.state !== 'ready' || last >= total}
                    onClick={forward}
                    className="size-14 rounded-full p-0"
                >
                    <Arrow />
                </Button>
            </div>
        </div>
    );
}
