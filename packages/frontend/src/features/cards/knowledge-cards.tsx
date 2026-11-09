import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CheckIcon } from '../../components/icons/check-icon';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { textLink } from '../../components/ui/text-link';
import { SubjectArt, subjects } from '../assignments/subject-art';
import { ChapterSticker } from '../path/chapter-sticker';
import { studentCardsQuery } from './queries';

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
            <Link to="/student" className={textLink}>
                Kembali ke beranda
            </Link>
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
                    <ul className="flex flex-wrap gap-4">
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
                                    {subjects[sticker.subject].label}
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
                    <ul className="grid gap-4 sm:grid-cols-2">
                        {cards.map((card) => (
                            <li
                                key={card.id}
                                className="border-paper-edge space-y-3 rounded-2xl border-2 border-b-[5px] bg-white p-4"
                            >
                                <div className="flex items-center gap-3">
                                    <SubjectArt
                                        subject={card.subject}
                                        className="size-12"
                                    />
                                    <div className="min-w-0">
                                        <p className="text-muted-foreground text-base">
                                            {subjects[card.subject].label} ·{' '}
                                            {card.chapter}
                                        </p>
                                        <h3 className="font-display text-primary-deep text-lg leading-snug font-semibold break-words">
                                            {card.title}
                                        </h3>
                                    </div>
                                </div>
                                <ul className="space-y-2">
                                    {card.takeaways.map((takeaway) => (
                                        <li
                                            key={takeaway}
                                            className="flex gap-2 text-lg leading-relaxed"
                                        >
                                            <CheckIcon className="text-primary mt-1.5 size-5 shrink-0" />
                                            {takeaway}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
