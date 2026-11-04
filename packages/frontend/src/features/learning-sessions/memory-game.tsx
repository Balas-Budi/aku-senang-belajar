import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { ScreenCard, ScreenHeading } from './session-ui';

const pink = 'var(--color-activity-pink)';
const green = 'var(--color-activity-green)';
const blue = 'var(--color-activity-blue)';
const orange = 'var(--color-activity-orange)';
const yellow = 'var(--color-jalak-beak)';

const pictures: { name: string; drawing: ReactNode }[] = [
    {
        name: 'apel',
        drawing: (
            <>
                <path
                    d="M24 15c-5-3-15-2-15 9 0 9 7 17 11 17 2 0 3-1 4-1s2 1 4 1c4 0 11-8 11-17 0-11-10-12-15-9z"
                    fill={pink}
                />
                <path d="M24 15c0-3 1-6 3-8" />
                <path d="M27 11c2-4 7-5 10-3-2 4-7 5-10 3z" fill={green} />
            </>
        ),
    },
    {
        name: 'ikan',
        drawing: (
            <>
                <path d="M33 24l9-8v16z" fill={blue} />
                <path d="M7 24c5-8 18-11 27 0-9 11-22 8-27 0z" fill={blue} />
                <circle
                    cx="14"
                    cy="22"
                    r="1.6"
                    fill="var(--color-primary-deep)"
                    stroke="none"
                />
            </>
        ),
    },
    {
        name: 'bunga',
        drawing: (
            <>
                {[
                    [24, 15],
                    [32.6, 21.2],
                    [29.3, 31.3],
                    [18.7, 31.3],
                    [15.4, 21.2],
                ].map(([cx, cy]) => (
                    <circle key={cx} cx={cx} cy={cy} r="6" fill={orange} />
                ))}
                <circle cx="24" cy="24" r="4.5" fill={yellow} />
            </>
        ),
    },
    {
        name: 'daun',
        drawing: (
            <>
                <path d="M9 39C9 21 21 9 39 9c0 18-12 30-30 30z" fill={green} />
                <path d="M9 39 31 17" />
            </>
        ),
    },
    {
        name: 'bola',
        drawing: (
            <>
                <circle cx="24" cy="24" r="14" fill={yellow} />
                <path d="M10.6 20c9 4 17.8 4 26.8 0M10.6 28c9-4 17.8-4 26.8 0" />
            </>
        ),
    },
    {
        name: 'layang-layang',
        drawing: (
            <>
                <path
                    d="M24 6 37 21 24 36 11 21z"
                    fill="var(--color-primary)"
                />
                <path d="M24 7v28M12 21h24" stroke="white" strokeWidth="2" />
                <path d="M24 36c-3 3 3 5 0 8" />
            </>
        ),
    },
];

function shuffled(seed: number) {
    const cards = pictures.flatMap((_, picture) => [picture, picture]);
    let state = seed % 2147483647 || 1;
    for (let index = cards.length - 1; index > 0; index -= 1) {
        state = (state * 48271) % 2147483647;
        const other = state % (index + 1);
        [cards[index], cards[other]] = [cards[other], cards[index]];
    }
    return cards;
}

export function MemoryGame({
    seed,
    onDone,
}: {
    seed: number;
    onDone: () => void;
}) {
    const cards = useMemo(() => shuffled(seed), [seed]);
    const [open, setOpen] = useState<number[]>([]);
    const [matched, setMatched] = useState<number[]>([]);
    const [message, setMessage] = useState('');
    const finished = matched.length === pictures.length;

    useEffect(() => {
        if (open.length < 2) return;
        const [first, second] = open;
        if (cards[first] === cards[second]) {
            setMatched((found) => [...found, cards[first]]);
            setOpen([]);
            setMessage(`Cocok! Dua kartu ${pictures[cards[first]].name}.`);
            return;
        }
        setMessage('Belum sama. Ingat letaknya, lalu coba lagi.');
        const timer = setTimeout(() => setOpen([]), 900);
        return () => clearTimeout(timer);
    }, [open, cards]);

    function reveal(index: number) {
        if (
            open.length === 2 ||
            open.includes(index) ||
            matched.includes(cards[index])
        )
            return;
        setOpen((current) => [...current, index]);
    }

    return (
        <ScreenCard aria-labelledby="memory-title">
            <div>
                <ScreenHeading id="memory-title">
                    Pasangan Rahasia
                </ScreenHeading>
                <p className="text-muted-foreground mt-2 leading-relaxed">
                    Buka dua kartu, lalu cari gambar yang sama. Ini pemanasan
                    supaya kamu siap fokus.
                </p>
            </div>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {cards.map((picture, index) => {
                    const done = matched.includes(picture);
                    const shown = done || open.includes(index);
                    return (
                        <li key={index}>
                            <button
                                type="button"
                                onClick={() => reveal(index)}
                                aria-disabled={done}
                                aria-label={
                                    shown
                                        ? `Kartu ${index + 1}, ${pictures[picture].name}${done ? ', sudah berpasangan' : ''}`
                                        : `Kartu ${index + 1}, tertutup`
                                }
                                data-shown={shown || undefined}
                                className={cn(
                                    'memory-card border-border focus-visible:outline-ring aspect-square w-full rounded-2xl border-2 border-b-[5px] focus-visible:outline-3 focus-visible:outline-offset-2',
                                    done && 'border-primary-deep',
                                )}
                            >
                                <span className="memory-card-inner">
                                    <span
                                        aria-hidden="true"
                                        className="memory-card-side bg-secondary font-display text-primary rounded-[0.8rem] text-[2em]"
                                    >
                                        ?
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'memory-card-side memory-card-face rounded-[0.8rem] bg-white',
                                            done && 'bg-activity-green/15',
                                        )}
                                    >
                                        <svg
                                            viewBox="0 0 48 48"
                                            fill="none"
                                            stroke="var(--color-primary-deep)"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="w-[72%]"
                                        >
                                            {pictures[picture].drawing}
                                        </svg>
                                    </span>
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <p
                role="status"
                className="text-primary-deep min-h-7 font-semibold"
            >
                {finished
                    ? 'Semua pasangan ketemu! Fokusmu sudah siap.'
                    : message}
            </p>
            {finished ? (
                <Button
                    feel="chunky"
                    className="w-full sm:w-auto"
                    onClick={onDone}
                >
                    Lanjut
                </Button>
            ) : (
                <Button
                    feel="chunky"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={onDone}
                >
                    Lewati game
                </Button>
            )}
        </ScreenCard>
    );
}
