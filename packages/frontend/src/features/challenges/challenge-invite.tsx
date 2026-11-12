import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { buttonVariants } from '../../components/ui/button';
import { studentChallengeQuery } from './queries';

export function ChallengeInvite() {
    const { data } = useQuery(studentChallengeQuery());
    const challenge = data?.challenge;
    if (!challenge) return null;
    const revealed = challenge.state === 'revealed';
    return (
        <section
            aria-labelledby="challenge-invite-title"
            className="bg-student-accent-soft space-y-3 rounded-2xl p-4 sm:p-5"
        >
            <div>
                <h4
                    id="challenge-invite-title"
                    className="font-display text-primary-deep text-xl font-semibold"
                >
                    Tantangan kelas
                </h4>
                <p className="text-student-accent-ink mt-1 text-base leading-relaxed">
                    {revealed
                        ? 'Gurumu sudah menampilkan hasil tantangan.'
                        : challenge.answered
                          ? 'Jawaban terkirim. Tunggu gurumu menampilkan hasilnya, ya.'
                          : 'Gurumu punya satu pertanyaan untuk kelasmu.'}
                </p>
            </div>
            <Link
                to="/student/challenge"
                className={buttonVariants({
                    feel: 'chunky',
                    variant:
                        challenge.answered && !revealed ? 'outline' : 'primary',
                    className: 'w-full sm:w-auto',
                })}
            >
                {revealed
                    ? 'Lihat hasilnya'
                    : challenge.answered
                      ? 'Lihat jawabanku'
                      : 'Jawab tantangan'}
            </Link>
        </section>
    );
}
