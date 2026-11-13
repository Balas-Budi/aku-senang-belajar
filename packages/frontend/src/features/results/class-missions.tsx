import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { SubjectArt, SubjectName } from '../assignments/subject-art';
import { SectionTitle } from '../../components/section-title';
import { SendIcon } from '../../components/icons/workspace-icons';
import { FollowUpsLink } from '../follow-ups/follow-up-plan';
import { classMissionsQuery } from './queries';

function Progress({
    done,
    total,
    label,
}: {
    done: number;
    total: number;
    label: string;
}) {
    return (
        <div className="space-y-1">
            <p className="text-sm tabular-nums">{label}</p>
            <span
                aria-hidden="true"
                className="bg-secondary block h-2 max-w-xs overflow-hidden rounded-full"
            >
                <span
                    className="bg-primary block h-full rounded-full"
                    style={{
                        width: `${total === 0 ? 0 : Math.round((done / total) * 100)}%`,
                    }}
                />
            </span>
        </div>
    );
}

export function ClassMissions({ classId }: { classId: number }) {
    const missions = useQuery(classMissionsQuery(classId));

    return (
        <Card>
            <section aria-labelledby="missions-title" className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                    <SectionTitle id="missions-title" icon={<SendIcon />}>
                        Misi kelas
                    </SectionTitle>
                    <FollowUpsLink classId={classId} />
                </div>
                {missions.isPending ? (
                    <p role="status">Memuat misi…</p>
                ) : missions.isError ? (
                    <div className="space-y-3">
                        <RequestError error={missions.error} />
                        <Button
                            onClick={() => {
                                void missions.refetch();
                            }}
                        >
                            Muat ulang misi
                        </Button>
                    </div>
                ) : missions.data.length === 0 ? (
                    <p>
                        Belum ada misi untuk kelas ini. Misi yang diberikan ke
                        kelas ini akan muncul di sini.
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {missions.data.map((mission) => (
                            <li
                                key={mission.id}
                                className="border-paper-edge flex flex-wrap items-center gap-4 rounded-2xl border p-4"
                            >
                                <SubjectArt
                                    subject={mission.subject}
                                    className="hidden size-12 sm:flex"
                                />
                                <div className="min-w-0 flex-1 basis-56 space-y-2">
                                    <div>
                                        <h3 className="text-base font-semibold break-words">
                                            {mission.title}
                                        </h3>
                                        <p className="text-muted-foreground text-sm">
                                            <SubjectName
                                                subject={mission.subject}
                                            />{' '}
                                            · {mission.moduleTitle}
                                        </p>
                                    </div>
                                    <Progress
                                        done={mission.submittedCount}
                                        total={mission.studentCount}
                                        label={`${mission.submittedCount} dari ${mission.studentCount} siswa mengirim · ${mission.analysedCount} dianalisis`}
                                    />
                                </div>
                                <Link
                                    to={`/teacher/classes/${classId}/sessions/${mission.id}`}
                                    aria-label={`Lihat hasil ${mission.title}`}
                                    className={buttonVariants({
                                        variant: 'outline',
                                        className:
                                            'min-h-11 w-full bg-white px-4 sm:w-auto',
                                    })}
                                >
                                    Lihat hasil
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </Card>
    );
}
