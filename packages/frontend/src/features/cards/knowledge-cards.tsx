import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { StudentNavLink } from '../../components/student-nav-link';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import {
    SubjectArt,
    SubjectName,
    useSubject,
} from '../assignments/subject-art';
import { ChapterSticker } from '../path/chapter-sticker';
import { studentCardsQuery, type KnowledgeCards as Cards } from './queries';

export function KnowledgeCards() {
    const query = useQuery(studentCardsQuery());
    if (query.isPending)
        return (
            <p role="status" className="text-muted-foreground">
                Sebentar, kita ambil kartumu…
            </p>
        );
    if (query.isError)
        return (
            <div className="space-y-3">
                <RequestError error={query.error} />
                <Button
                    feel="chunky"
                    onClick={() => {
                        void query.refetch();
                    }}
                >
                    Muat ulang kartu
                </Button>
            </div>
        );
    const { cards, stickers } = query.data;
    return (
        <div className="space-y-6">
            <StudentNavLink back to="/student">
                Kembali ke beranda
            </StudentNavLink>
            <header className="border-paper-edge rounded-[24px] border-2 border-b-[6px] bg-white p-5 sm:p-7">
                <h1 className="font-display text-primary-deep text-3xl leading-tight font-semibold sm:text-4xl">
                    Kartu pengetahuanku
                </h1>
                <p className="text-muted-foreground mt-1 text-lg">
                    Setiap misi yang selesai memberi satu kartu, dan setiap bab
                    yang selesai memberi satu stiker.
                </p>
            </header>
            {stickers.length > 0 && (
                <section aria-labelledby="stickers-title" className="space-y-3">
                    <h2
                        id="stickers-title"
                        className="font-display text-primary-deep text-xl font-semibold"
                    >
                        Stiker bab
                    </h2>
                    <ul className="border-paper-edge flex flex-wrap justify-center gap-4 rounded-[24px] border-2 border-dashed bg-white/70 p-4 sm:justify-start sm:p-5">
                        {stickers.map((sticker) => (
                            <li
                                key={sticker.id}
                                className="flex w-32 flex-col items-center gap-2 text-center"
                            >
                                <ChapterSticker
                                    subject={sticker.subject}
                                    className="size-24"
                                />
                                <span className="text-muted-foreground text-base">
                                    <SubjectName subject={sticker.subject} />
                                </span>
                                <span className="font-display text-primary-deep leading-snug font-semibold break-words">
                                    {sticker.title}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <section aria-labelledby="cards-title" className="space-y-3">
                <h2
                    id="cards-title"
                    className="font-display text-primary-deep text-xl font-semibold"
                >
                    Kartu
                </h2>
                {cards.length === 0 ? (
                    <p className="bg-student-accent-soft rounded-2xl p-4 text-lg leading-relaxed sm:p-5">
                        Selesaikan misi pertamamu, lalu kartunya muncul di sini.
                    </p>
                ) : (
                    <ul className="grid gap-6 sm:grid-cols-2 sm:gap-8">
                        {cards.map((card, index) => (
                            <KnowledgeCard
                                key={card.id}
                                card={card}
                                number={index + 1}
                            />
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function StarIcon({ className }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className}>
            <path
                d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"
                fill="var(--card)"
                stroke="var(--color-primary-deep)"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function KnowledgeCard({
    card,
    number,
}: {
    card: Cards['cards'][number];
    number: number;
}) {
    const subject = useSubject(card.subject);
    return (
        <li
            style={{ '--card': subject.color } as CSSProperties}
            className={cn(
                'knowledge-card flex flex-col overflow-hidden rounded-[24px] border-2 border-b-[6px] bg-white',
                number % 2 === 0 ? 'sm:rotate-[0.6deg]' : 'sm:-rotate-[0.6deg]',
            )}
        >
            <div className="knowledge-card-art relative flex h-36 items-center justify-center">
                <span className="font-display text-primary-deep absolute top-3 right-3 rounded-full bg-white px-3 py-1 text-sm font-semibold">
                    No. {String(number).padStart(2, '0')}
                </span>
                <SubjectArt
                    subject={card.subject}
                    className="size-24 -rotate-6 rounded-[28px] bg-white shadow-[0_5px_0_var(--card-edge)]"
                />
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                    <p className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                        {subject.label} · {card.chapter}
                    </p>
                    <h3 className="font-display text-primary-deep mt-1 text-xl leading-snug font-semibold break-words">
                        {card.title}
                    </h3>
                </div>
                <div className="border-paper-edge border-t-2 border-dashed pt-3">
                    <h4 className="font-display text-primary-deep font-semibold">
                        Yang kuingat
                    </h4>
                    <ul className="mt-2 space-y-2">
                        {card.takeaways.map((takeaway) => (
                            <li
                                key={takeaway}
                                className="flex gap-2 text-lg leading-relaxed"
                            >
                                <StarIcon className="mt-1 size-5 shrink-0" />
                                {takeaway}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </li>
    );
}
