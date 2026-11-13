import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { cellLink } from '../../components/ui/text-link';
import {
    Table,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import { subjects } from '../assignments/subject-art';
import { classesQuery } from '../classes/queries';
import {
    reviewLabel,
    ShownStatus,
    statusLabels,
    StatusLegend,
} from '../results/status';
import { chapterReportQuery, type Counts } from './queries';
import { ReportText } from './report-text';
import { BackLink } from '../../components/back-link';

function countsLine(counts: Counts | undefined, students: number) {
    if (!counts) return `0 dari ${students} siswa sudah punya bukti`;
    return [
        `${counts.visible} ${statusLabels.visible}`,
        `${counts.developing} ${statusLabels.developing}`,
        `${counts.needsVerification} ${statusLabels.needs_verification}`,
        `${counts.notObserved} ${statusLabels.not_observed}`,
        `${counts.withEvidence} dari ${students} siswa sudah punya bukti`,
    ].join(' · ');
}

export function ChapterReport({
    classId,
    moduleId,
}: {
    classId: number;
    moduleId: number;
}) {
    const query = useQuery(chapterReportQuery(classId, moduleId));
    const classes = useQuery(classesQuery());
    const className = classes.data?.find(({ id }) => id === classId)?.name;
    const back = (
        <BackLink to={`/teacher/classes/${classId}?bagian=bab`}>
            Kembali ke {className ?? 'kelas'}
        </BackLink>
    );

    if (query.isPending) {
        return (
            <>
                {back}
                <p role="status">Memuat laporan bab…</p>
            </>
        );
    }

    if (query.isError) {
        return (
            <>
                {back}
                <div className="space-y-3">
                    <RequestError error={query.error} />
                    <Button
                        onClick={() => {
                            void query.refetch();
                        }}
                    >
                        Muat ulang laporan
                    </Button>
                </div>
            </>
        );
    }

    const { chapter, missions, competencies, students, counts } = query.data;
    const reportUrl = `/api/classes/${classId}/chapters/${moduleId}/report`;

    return (
        <div className="space-y-6">
            {back}
            <Card className="space-y-2 print:border-0 print:p-0 print:shadow-none">
                <h1 className="font-display text-primary-deep text-3xl leading-tight font-semibold break-words sm:text-4xl">
                    Laporan bab {chapter.title}
                </h1>
                <p className="text-muted-foreground">
                    {className ? `${className} · ` : ''}
                    {subjects[chapter.subject].label} · {missions.length} misi
                </p>
                <div className="flex flex-wrap gap-2 print:hidden">
                    <Button variant="outline" onClick={() => window.print()}>
                        Cetak atau simpan PDF
                    </Button>
                    <a
                        href={`${reportUrl}.csv`}
                        download
                        className={buttonVariants({ variant: 'outline' })}
                    >
                        Unduh CSV
                    </a>
                </div>
            </Card>
            <ReportText
                classId={classId}
                reportUrl={reportUrl}
                report={query.data.report}
                summaryCount={query.data.summaryCount}
                about="Disusun AI dari ringkasan misi siswa di bab ini, tanpa menyebut siswa satu per satu."
            />
            <Card>
                <section
                    aria-labelledby="competencies-title"
                    className="space-y-3"
                >
                    <h2
                        id="competencies-title"
                        className="font-display text-primary-deep text-xl font-semibold sm:text-2xl"
                    >
                        Kompetensi
                    </h2>
                    <dl className="space-y-3">
                        {competencies.map((competency) => (
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
                                        {countsLine(
                                            counts.find(
                                                ({ competencyId }) =>
                                                    competencyId ===
                                                    competency.id,
                                            ),
                                            students.length,
                                        )}
                                    </span>
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            </Card>
            <Card>
                <section aria-labelledby="map-title" className="space-y-4">
                    <div className="space-y-1">
                        <h2
                            id="map-title"
                            className="font-display text-primary-deep text-xl font-semibold sm:text-2xl"
                        >
                            Peta kelas
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Tiap sel memakai misi terbaru yang mengajarkan
                            kompetensi itu. Riwayat lengkapnya ada di laporan
                            siswa.
                        </p>
                    </div>
                    <StatusLegend />
                    {students.length === 0 ? (
                        <p>
                            Belum ada siswa di kelas ini. Bagikan kode kelas
                            agar siswa dapat bergabung.
                        </p>
                    ) : (
                        <div
                            role="region"
                            aria-label="Tabel peta kelas"
                            tabIndex={0}
                            className="border-paper-edge focus-visible:outline-ring relative overflow-x-auto rounded-lg border focus-visible:outline-3 print:overflow-visible"
                        >
                            <Table className="min-w-[42rem] print:min-w-0">
                                <TableHeader>
                                    <tr>
                                        <TableHead
                                            scope="col"
                                            className="bg-muted sticky left-0"
                                        >
                                            Siswa
                                        </TableHead>
                                        <TableHead scope="col">
                                            Misi selesai
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
                                        <TableRow key={student.id}>
                                            <th
                                                scope="row"
                                                className="bg-background group-hover:bg-muted sticky left-0 px-4 py-3 text-left align-top font-normal"
                                            >
                                                <Link
                                                    to={`/teacher/classes/${classId}/students/${student.id}`}
                                                    className={`${cellLink} font-semibold`}
                                                >
                                                    {student.name}
                                                </Link>
                                            </th>
                                            <TableCell className="tabular-nums">
                                                {student.finished} dari{' '}
                                                {missions.length}
                                            </TableCell>
                                            {competencies.map((competency) => {
                                                const cell =
                                                    student.competencies.find(
                                                        ({ competencyId }) =>
                                                            competencyId ===
                                                            competency.id,
                                                    );

                                                return (
                                                    <TableCell
                                                        key={competency.id}
                                                    >
                                                        {cell ? (
                                                            <Link
                                                                to={`/teacher/classes/${classId}/sessions/${cell.assignmentId}/students/${student.id}#kompetensi-${competency.code}`}
                                                                aria-label={`${statusLabels[cell.status]}, ${reviewLabel(cell.decision)}: ${competency.code} ${student.name}. Lihat bukti`}
                                                                className="focus-visible:outline-ring hover:bg-secondary -m-1 inline-block min-h-11 rounded-md p-1 focus-visible:outline-3"
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
                                                    </TableCell>
                                                );
                                            })}
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
