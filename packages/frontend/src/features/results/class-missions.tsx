import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { subjects } from '../assignments/subject-art';
import { classMissionsQuery } from './queries';

export function ClassMissions({ classId }: { classId: number }) {
    const missions = useQuery(classMissionsQuery(classId));

    return (
        <section aria-labelledby="missions-title" className="space-y-4">
            <h2 id="missions-title" className="text-xl font-semibold">
                Misi kelas
            </h2>
            {missions.isPending ? (
                <p role="status">Memuat misi…</p>
            ) : missions.isError ? (
                <>
                    <RequestError error={missions.error} />
                    <Button
                        onClick={() => {
                            void missions.refetch();
                        }}
                    >
                        Muat ulang misi
                    </Button>
                </>
            ) : missions.data.length === 0 ? (
                <p>
                    Belum ada misi untuk kelas ini. Misi yang diberikan ke kelas
                    ini akan muncul di sini.
                </p>
            ) : (
                <ul className="divide-border border-border divide-y border-y">
                    {missions.data.map((mission) => (
                        <li
                            key={mission.id}
                            className="flex flex-wrap items-center justify-between gap-4 py-5"
                        >
                            <div className="space-y-1">
                                <h3 className="text-lg font-semibold">
                                    {mission.title}
                                </h3>
                                <p className="text-muted-foreground">
                                    {subjects[mission.subject].label} ·{' '}
                                    {mission.moduleTitle}
                                </p>
                                <p>
                                    {mission.submittedCount} dari{' '}
                                    {mission.studentCount} siswa sudah mengirim
                                    · {mission.analysedCount} sudah dianalisis
                                </p>
                            </div>
                            <Link
                                to={`/teacher/classes/${classId}/sessions/${mission.id}`}
                                aria-label={`Lihat hasil ${mission.title}`}
                                className={buttonVariants({
                                    variant: 'outline',
                                })}
                            >
                                Lihat hasil
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
