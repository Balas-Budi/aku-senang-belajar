import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { subjects } from '../assignments/subject-art';
import { classesQuery } from '../classes/queries';
import { AnalyseAgain, stateLabel, waitsForTeacher } from './analysis-state';
import { sessionResultsQuery } from './queries';
import { reviewLabel, ShownStatus, statusLabels, StatusLegend } from './status';

const linkStyle =
    'text-primary focus-visible:outline-ring rounded underline underline-offset-4 focus-visible:outline-3';

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
        <Link
            to={`/teacher/classes/${classId}`}
            className="text-primary inline-block min-h-12 py-3 underline underline-offset-4"
        >
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
        <div className="space-y-8">
            <div>
                {back}
                <h1 className="mt-2 text-3xl font-bold">{assignment.title}</h1>
                <p className="text-muted-foreground mt-2">
                    {subjects[assignment.subject].label} ·{' '}
                    {assignment.moduleTitle}
                </p>
                <p className="mt-2">
                    {submitted} dari {students.length} siswa sudah mengirim ·{' '}
                    {analysed} sudah dianalisis
                </p>
            </div>
            <section aria-labelledby="competencies-title" className="space-y-3">
                <h2 id="competencies-title" className="text-xl font-semibold">
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
                                    <span className="text-muted-foreground block text-sm">
                                        {covered} dari {students.length} siswa
                                        sudah punya bukti
                                    </span>
                                </dd>
                            </div>
                        );
                    })}
                </dl>
            </section>
            <section aria-labelledby="results-title" className="space-y-4">
                <h2 id="results-title" className="text-xl font-semibold">
                    Hasil per siswa
                </h2>
                <StatusLegend />
                {students.length === 0 ? (
                    <p>
                        Belum ada siswa di kelas ini. Bagikan kode kelas agar
                        siswa dapat bergabung.
                    </p>
                ) : (
                    <div
                        role="region"
                        aria-label="Tabel hasil per siswa"
                        tabIndex={0}
                        className="border-border focus-visible:outline-ring overflow-x-auto rounded-lg border focus-visible:outline-3"
                    >
                        <table className="w-full min-w-[42rem] text-left">
                            <thead className="bg-muted">
                                <tr>
                                    <th
                                        scope="col"
                                        className="bg-muted sticky left-0 px-4 py-3"
                                    >
                                        Siswa
                                    </th>
                                    {competencies.map((competency) => (
                                        <th
                                            key={competency.id}
                                            scope="col"
                                            className="px-4 py-3"
                                        >
                                            {competency.code}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-border divide-y">
                                {students.map((student) => (
                                    <tr
                                        key={student.id}
                                        id={`siswa-${student.id}`}
                                        className="scroll-mt-6 align-top"
                                    >
                                        <th
                                            scope="row"
                                            className="bg-background sticky left-0 px-4 py-3 text-left font-normal"
                                        >
                                            {student.attemptId === null ? (
                                                student.name
                                            ) : (
                                                <Link
                                                    to={evidenceOf(student.id)}
                                                    className={`${linkStyle} font-semibold`}
                                                >
                                                    {student.name}
                                                </Link>
                                            )}
                                        </th>
                                        {student.analysis === 'succeeded' ? (
                                            competencies.map((competency) => {
                                                const cell =
                                                    student.competencies.find(
                                                        ({ competencyId }) =>
                                                            competencyId ===
                                                            competency.id,
                                                    );

                                                return (
                                                    <td
                                                        key={competency.id}
                                                        className="px-4 py-3"
                                                    >
                                                        {cell ? (
                                                            <Link
                                                                to={`${evidenceOf(student.id)}#kompetensi-${competency.code}`}
                                                                aria-label={`${statusLabels[cell.status]}, ${reviewLabel(cell.decision)}: ${competency.code} ${student.name}. Lihat bukti`}
                                                                className="focus-visible:outline-ring hover:bg-muted -m-1 inline-block min-h-11 rounded-md p-1 focus-visible:outline-3"
                                                            >
                                                                <ShownStatus
                                                                    shown={cell}
                                                                />
                                                            </Link>
                                                        ) : (
                                                            <span className="text-muted-foreground">
                                                                Belum ada
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })
                                        ) : (
                                            <td
                                                colSpan={competencies.length}
                                                className="px-4 py-3"
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
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
