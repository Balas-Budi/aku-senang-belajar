import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { CheckIcon } from '../../components/icons/check-icon';
import { LottieMoment } from '../../components/lottie-moment';
import { requestErrorMessage } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { textLink } from '../../components/ui/text-link';
import { useErrorToast } from '../../components/ui/toast';
import { cn } from '../../lib/cn';
import { SubjectArt, subjects } from '../assignments/subject-art';
import { studentPathQuery, subjectStages } from '../path/queries';
import { useStartAttempt, type Done, type LearningSession } from './queries';
import { ReactingJalak, ScreenCard, ScreenHeading } from './session-ui';
import { stepLabels, stepOrder } from './steps';

const homeButton = (variant: 'primary' | 'outline') =>
    cn(buttonVariants({ variant, feel: 'chunky' }), 'w-full sm:w-auto');

export function SessionPreparing() {
    return (
        <ScreenCard aria-labelledby="preparing-title">
            <ScreenHeading id="preparing-title">
                Misi ini sedang disiapkan
            </ScreenHeading>
            <p className="leading-relaxed">
                Isinya belum siap. Pilih misi lain di beranda dulu, ya.
            </p>
            <Link to="/student" className={homeButton('primary')}>
                Kembali ke beranda
            </Link>
        </ScreenCard>
    );
}

export function SessionIntro({
    session,
    teacher,
}: {
    session: LearningSession;
    teacher: string;
}) {
    const start = useStartAttempt(session.id);
    const showError = useErrorToast();
    return (
        <ScreenCard aria-labelledby="intro-title">
            <div className="flex items-center gap-4">
                <SubjectArt subject={session.subject} className="size-16" />
                <p className="text-muted-foreground leading-snug">
                    <span className="text-primary-deep font-bold">
                        {subjects[session.subject].label}
                    </span>
                    <br />
                    Bab {session.moduleTitle}
                </p>
            </div>
            <ScreenHeading id="intro-title" className="text-[1.75em]">
                {session.title}
            </ScreenHeading>
            <p className="leading-relaxed">{session.summary}</p>
            <ol className="flex flex-wrap gap-2" aria-label="Langkah misi">
                {stepOrder.map((step, index) => (
                    <li
                        key={step}
                        className="bg-student-surface text-primary-deep rounded-full px-4 py-2 font-semibold"
                    >
                        {index + 1}. {stepLabels[step]}
                    </li>
                ))}
            </ol>
            <p className="text-muted-foreground leading-relaxed">
                Misi dari {teacher}. Jawabanmu tersimpan di setiap langkah, jadi
                kamu bisa istirahat lalu lanjut lagi.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                    feel="chunky"
                    disabled={start.isPending}
                    onClick={() =>
                        start.mutate(undefined, {
                            onError: (error) =>
                                showError(requestErrorMessage(error)),
                        })
                    }
                >
                    {start.isPending ? 'Menyiapkan…' : 'Mulai misi'}
                </Button>
                <Link
                    to={`/student/chapters/${session.moduleId}`}
                    className={homeButton('outline')}
                >
                    Nanti saja
                </Link>
            </div>
        </ScreenCard>
    );
}

export function SessionDone({
    session,
    done,
    teacher,
}: {
    session: LearningSession;
    done: Done;
    teacher: string;
}) {
    const path = useQuery(studentPathQuery());
    const stages = path.data ? subjectStages(path.data, session.moduleId) : [];
    const next = stages
        .slice(stages.findIndex((stage) => stage.id === session.id) + 1)
        .find((stage) => stage.progress !== 'submitted' && !stage.locked);
    return (
        <ScreenCard aria-labelledby="done-title" className="relative">
            <LottieMoment
                path="/lottie/celebrate.json"
                className="absolute inset-x-0 top-0 mx-auto aspect-[3/2] w-full max-w-md"
            />
            <div className="relative flex flex-col items-center gap-3 text-center">
                <ReactingJalak cheers={1} chirps={0} className="w-24" />
                <ScreenHeading id="done-title" className="text-[2em]">
                    Misi selesai!
                </ScreenHeading>
                <p className="text-muted-foreground leading-relaxed">
                    Kamu sudah menyelesaikan {session.title}.
                </p>
            </div>
            {done.takeaways.length > 0 && (
                <section
                    aria-labelledby="learned-title"
                    className="bg-student-surface rounded-2xl p-4"
                >
                    <h2
                        id="learned-title"
                        className="font-display text-primary-deep text-[1.2em] font-semibold"
                    >
                        Yang kamu pelajari hari ini
                    </h2>
                    <ul className="mt-2 space-y-2">
                        {done.takeaways.map((takeaway) => (
                            <li key={takeaway} className="flex gap-2">
                                <CheckIcon className="text-primary mt-[0.2em] size-[1.1em]" />
                                {takeaway}
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 leading-relaxed">
                        Kartu ini tersimpan di{' '}
                        <Link to="/student/cards" className={textLink}>
                            Kartu pengetahuanku
                        </Link>
                        .
                    </p>
                </section>
            )}
            {done.toPractise.length > 0 && (
                <section
                    aria-labelledby="practise-title"
                    className="bg-student-accent-soft rounded-2xl p-4"
                >
                    <h2
                        id="practise-title"
                        className="font-display text-student-accent-ink text-[1.2em] font-semibold"
                    >
                        Masih membingungkan
                    </h2>
                    <ul className="mt-2 list-disc space-y-1 pl-6">
                        {done.toPractise.map((topic) => (
                            <li key={topic}>{topic}</li>
                        ))}
                    </ul>
                    <p className="mt-2 leading-relaxed">
                        Ceritakan bagian ini ke {teacher} di kelas, ya.
                    </p>
                </section>
            )}
            <p className="text-center leading-relaxed">
                Jawabanmu sudah tersimpan untuk {teacher}.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
                {next && (
                    <Link
                        to={`/student/sessions/${next.id}`}
                        className={homeButton('primary')}
                    >
                        Lanjut ke misi berikutnya
                    </Link>
                )}
                <Link
                    to={`/student/chapters/${session.moduleId}`}
                    className={homeButton(next ? 'outline' : 'primary')}
                >
                    Kembali ke bab
                </Link>
            </div>
        </ScreenCard>
    );
}
