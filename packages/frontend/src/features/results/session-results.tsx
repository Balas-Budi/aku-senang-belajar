import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { cellLink, textLink } from '../../components/ui/text-link';
import {
    Table,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import { subjects } from '../assignments/subject-art';
import { classesQuery } from '../classes/queries';
import { LiveCard } from '../live/live-card';
import { AnalyseAgain, stateLabel, waitsForTeacher } from './analysis-state';
import { sessionResultsQuery } from './queries';
import { reviewLabel, ShownStatus, statusLabels, StatusLegend } from './status';

export function SessionResults({
    classId,
    assignmentId,
}: {
    classId: number;
    assignmentId: number;
}) {
    const results = useQuery(sessionResultsQuery(classId, assignmentId));
    const classes = useQuery(classesQuery());
    const className = classes.data?.find(({ id }) => id === classId)?.name;
    const back = (
        <Link to={`/teacher/classes/${classId}`} className={textLink}>
            Kembali ke {className ?? 'kelas'}
        </Link>
    );

    if (results.isPending) {
        return (
            <>
                {back}
                <p role="status">Memuat hasil misi…</p>
            </>
        );
    }

    if (results.isError) {
        return (
            <>
                {back}
                <div className="space-y-3">
                    <RequestError error={results.error} />
                    <Button
                        onClick={() => {
                            void results.refetch();
                        }}
                    >
                        Muat ulang hasil
                    </Button>
                </div>
            </>
        );
    }

    const { assignment, competencies, students } = results.data;
    const submitted = students.filter(
        ({ progress }) => progress === 'submitted',
    ).length;
    const analysed = students.filter(
        ({ analysis }) => analysis === 'succeeded',
    ).length;
    const evidenceOf = (studentId: number) =>
        `/teacher/classes/${classId}/sessions/${assignmentId}/students/${studentId}`;

    return (
        <div className="space-y-6">
            <div>
                {back}
                <h1 className="mt-1 text-2xl font-semibold">
                    {assignment.title}
                </h1>
                <p className="text-muted-foreground mt-1">
                    {subjects[assignment.subject].label} ·{' '}
                    {assignment.moduleTitle}
                </p>
                <p className="mt-2 tabular-nums">
                    {submitted} dari {students.length} siswa sudah mengirim ·{' '}
                    {analysed} sudah dianalisis
                </p>
            </div>
            <LiveCard classId={classId} assignmentId={assignmentId} />
            <Card>
                <section
                    aria-labelledby="competencies-title"
                    className="space-y-3"
                >
                    <h2
                        id="competencies-title"
                        className="text-lg font-semibold"
                    >
                        Kompetensi
                    </h2>
                    <dl className="space-y-3">
                        {competencies.map((competency) => {
                            const covered = students.filter((student) =>
                                student.competencies.some(
                                    (cell) =>
                                        cell.competencyId === competency.id &&
                                        cell.status !== 'not_observed',
                                ),
                            ).length;

                            return (
                                <div
                                    key={competency.id}
                                    className="grid gap-1 sm:grid-cols-[3rem_1fr]"
                                >
                                    <dt className="font-semibold">
                                        {competency.code}
                                    </dt>
                                    <dd>
                                        {competency.description}
                                        <span className="text-muted-foreground block text-sm tabular-nums">
                                            {covered} dari {students.length}{' '}
                                            siswa sudah punya bukti
                                        </span>
                                    </dd>
                                </div>
                            );
                        })}
                    </dl>
                </section>
            </Card>
            <Card>
                <section aria-labelledby="results-title" className="space-y-4">
                    <h2 id="results-title" className="text-lg font-semibold">
                        Hasil per siswa
                    </h2>
                    <StatusLegend />
                    {students.length === 0 ? (
                        <p>
                            Belum ada siswa di kelas ini. Bagikan kode kelas
                            agar siswa dapat bergabung.
                        </p>
                    ) : (
                        <div
                            role="region"
                            aria-label="Tabel hasil per siswa"
                            tabIndex={0}
                            className="border-paper-edge focus-visible:outline-ring relative overflow-x-auto rounded-lg border focus-visible:outline-3"
                        >
                            <Table className="min-w-[42rem]">
                                <TableHeader>
                                    <tr>
                                        <TableHead
                                            scope="col"
                                            className="bg-muted sticky left-0"
                                        >
                                            Siswa
                                        </TableHead>
                                        {competencies.map((competency) => (
                                            <TableHead
                                                key={competency.id}
                                                scope="col"
                                            >
                                                {competency.code}
                                            </TableHead>
                                        ))}
                                    </tr>
                                </TableHeader>
                                <tbody>
                                    {students.map((student) => (
                                        <TableRow
                                            key={student.id}
                                            id={`siswa-${student.id}`}
                                            className="scroll-mt-6"
                                        >
                                            <th
                                                scope="row"
                                                className="bg-background group-hover:bg-muted sticky left-0 px-4 py-3 text-left align-top font-normal"
                                            >
                                                {student.attemptId === null ? (
                                                    student.name
                                                ) : (
                                                    <Link
                                                        to={evidenceOf(
                                                            student.id,
                                                        )}
                                                        className={`${cellLink} font-semibold`}
                                                    >
                                                        {student.name}
                                                    </Link>
                                                )}
                                            </th>
                                            {student.analysis ===
                                            'succeeded' ? (
                                                competencies.map(
                                                    (competency) => {
                                                        const cell =
                                                            student.competencies.find(
                                                                ({
                                                                    competencyId,
                                                                }) =>
                                                                    competencyId ===
                                                                    competency.id,
                                                            );

                                                        return (
                                                            <TableCell
                                                                key={
                                                                    competency.id
                                                                }
                                                            >
                                                                {cell ? (
                                                                    <Link
                                                                        to={`${evidenceOf(student.id)}#kompetensi-${competency.code}`}
                                                                        aria-label={`${statusLabels[cell.status]}, ${reviewLabel(cell.decision)}: ${competency.code} ${student.name}. Lihat bukti`}
                                                                        className="focus-visible:outline-ring hover:bg-secondary -m-1 inline-block min-h-11 rounded-md p-1 focus-visible:outline-3"
                                                                    >
                                                                        <ShownStatus
                                                                            shown={
                                                                                cell
                                                                            }
                                                                        />
                                                                    </Link>
                                                                ) : (
                                                                    <span className="text-muted-foreground">
                                                                        Belum
                                                                        ada
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                        );
                                                    },
                                                )
                                            ) : (
                                                <TableCell
                                                    colSpan={
                                                        competencies.length
                                                    }
                                                >
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                        <span>
                                                            {stateLabel(
                                                                student.progress,
                                                                student.analysis,
                                                            )}
                                                        </span>
                                                        {student.attemptId !==
                                                            null &&
                                                            waitsForTeacher(
                                                                student.progress,
                                                                student.analysis,
                                                            ) && (
                                                                <AnalyseAgain
                                                                    classId={
                                                                        classId
                                                                    }
                                                                    attemptId={
                                                                        student.attemptId
                                                                    }
                                                                    analysis={
                                                                        student.analysis
                                                                    }
                                                                    studentName={
                                                                        student.name
                                                                    }
                                                                />
                                                            )}
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </section>
            </Card>
        </div>
    );
}
