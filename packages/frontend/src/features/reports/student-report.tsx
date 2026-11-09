import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { textLink } from '../../components/ui/text-link';
import {
    Table,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import { cn } from '../../lib/cn';
import { classesQuery } from '../classes/queries';
import {
    reviewLabel,
    ShownStatus,
    statusLabels,
    StatusLegend,
} from '../results/status';
import {
    type MissionHistory,
    studentReportQuery,
    useExcludeSummary,
} from './queries';
import { ReportText } from './report-text';

const day = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

const roundResults = {
    correct: 'benar',
    revealed: 'jawaban ditunjukkan',
    open: 'belum selesai',
};

function ChapterHistory({
    classId,
    studentId,
    studentName,
    chapter,
    missions,
}: {
    classId: number;
    studentId: number;
    studentName: string;
    chapter: string;
    missions: MissionHistory[];
}) {
    const competencies = [
        ...new Map(
            missions
                .flatMap((mission) => mission.competencies)
                .map((competency) => [competency.id, competency]),
        ).values(),
    ].sort((one, other) => one.code.localeCompare(other.code));
    return (
        <section className="space-y-2">
            <h3 className="font-semibold">{chapter}</h3>
            <div
                role="region"
                aria-label={`Riwayat kompetensi bab ${chapter}`}
                tabIndex={0}
                className="border-paper-edge focus-visible:outline-ring relative overflow-x-auto rounded-lg border focus-visible:outline-3 print:overflow-visible"
            >
                <Table className="min-w-[36rem]">
                    <TableHeader>
                        <tr>
                            <TableHead
                                scope="col"
                                className="bg-muted sticky left-0"
                            >
                                Misi
                            </TableHead>
                            {competencies.map((competency) => (
                                <TableHead
                                    key={competency.id}
                                    scope="col"
                                    title={competency.description}
                                >
                                    {competency.code}
                                </TableHead>
                            ))}
                        </tr>
                    </TableHeader>
                    <tbody>
                        {missions.map((mission) => (
                            <TableRow key={mission.assignmentId}>
                                <th
                                    scope="row"
                                    className="bg-background group-hover:bg-muted sticky left-0 px-4 py-3 text-left align-top font-normal"
                                >
                                    <span className="block font-semibold">
                                        {mission.title}
                                    </span>
                                    {mission.submittedAt && (
                                        <span className="text-muted-foreground block text-sm">
                                            {day.format(
                                                new Date(mission.submittedAt),
                                            )}
                                        </span>
                                    )}
                                </th>
                                {competencies.map((competency) => {
                                    const entry = mission.competencies.find(
                                        ({ id }) => id === competency.id,
                                    );

                                    return (
                                        <TableCell key={competency.id}>
                                            {entry ? (
                                                <Link
                                                    to={`/teacher/classes/${classId}/sessions/${mission.assignmentId}/students/${studentId}#kompetensi-${competency.code}`}
                                                    aria-label={`${statusLabels[entry.shown.status]}, ${reviewLabel(entry.shown.decision)}: ${competency.code} ${studentName}, ${mission.title}. Lihat bukti`}
                                                    className="focus-visible:outline-ring hover:bg-secondary -m-1 inline-block min-h-11 rounded-md p-1 focus-visible:outline-3"
                                                >
                                                    <ShownStatus
                                                        shown={entry.shown}
                                                    />
                                                    {entry.shown.decision !==
                                                        null &&
                                                        entry.shown.status !==
                                                            entry.estimate && (
                                                            <span className="text-muted-foreground block text-sm">
                                                                Saran AI:{' '}
                                                                {
                                                                    statusLabels[
                                                                        entry
                                                                            .estimate
                                                                    ]
                                                                }
                                                            </span>
                                                        )}
                                                </Link>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    Tidak diajarkan
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
        </section>
    );
}

function MissionSummary({
    classId,
    mission,
}: {
    classId: number;
    mission: MissionHistory;
}) {
    const exclude = useExcludeSummary(classId);
    const { summary } = mission;
    return (
        <li className="space-y-2 py-4">
            <p className="font-semibold">
                {mission.title}
                <span className="text-muted-foreground font-normal">
                    {' '}
                    · {mission.chapter}
                </span>
            </p>
            {summary ? (
                <>
                    <p
                        className={cn(
                            'leading-relaxed',
                            summary.excluded && 'text-muted-foreground',
                        )}
                    >
                        <span className="text-ai-suggestion font-medium">
                            Saran AI:
                        </span>{' '}
                        {summary.text}
                    </p>
                    {summary.excluded && (
                        <p className="text-sm">
                            Ditandai tidak sesuai, jadi tidak dipakai untuk
                            ringkasan dan personalisasi.
                        </p>
                    )}
                    <Button
                        variant="outline"
                        className="print:hidden"
                        disabled={exclude.isPending}
                        onClick={() =>
                            exclude.mutate({
                                summaryId: summary.id,
                                excluded: !summary.excluded,
                            })
                        }
                    >
                        {summary.excluded
                            ? 'Pakai lagi'
                            : 'Tandai tidak sesuai'}
                    </Button>
                    <RequestError error={exclude.error} />
                </>
            ) : (
                <p className="text-muted-foreground">
                    {mission.memoryDeleted
                        ? 'Ringkasan misi ini dihapus bersama memori belajar siswa.'
                        : mission.analysis === 'succeeded'
                          ? 'Ringkasan misi ini belum ditulis.'
                          : 'Misi ini belum dianalisis.'}
                </p>
            )}
        </li>
    );
}

export function StudentReport({
    classId,
    studentId,
}: {
    classId: number;
    studentId: number;
}) {
    const query = useQuery(studentReportQuery(classId, studentId));
    const classes = useQuery(classesQuery());
    const className = classes.data?.find(({ id }) => id === classId)?.name;
    const back = (
        <Link
            to={`/teacher/classes/${classId}`}
            className={`${textLink} print:hidden`}
        >
            Kembali ke {className ?? 'kelas'}
        </Link>
    );

    if (query.isPending) {
        return (
            <>
                {back}
                <p role="status">Memuat laporan siswa…</p>
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

    const { student, missions } = query.data;
    const chapters = [...new Set(missions.map(({ chapter }) => chapter))];

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                {back}
                <h1 className="text-2xl font-semibold">{student.name}</h1>
                <p className="text-muted-foreground">
                    Laporan siswa{className ? ` · ${className}` : ''} ·{' '}
                    {missions.length} misi selesai
                </p>
                <Button
                    variant="outline"
                    className="print:hidden"
                    onClick={() => window.print()}
                >
                    Cetak atau simpan PDF
                </Button>
            </div>
            <ReportText
                classId={classId}
                reportUrl={`/api/classes/${classId}/students/${studentId}/report`}
                report={query.data.report}
                summaryCount={query.data.summaryCount}
                about="Disusun AI dari ringkasan misi siswa ini yang tidak ditandai tidak sesuai, tanpa nama siswa."
            />
            <Card>
                <section aria-labelledby="history-title" className="space-y-4">
                    <div className="space-y-1">
                        <h2
                            id="history-title"
                            className="text-lg font-semibold"
                        >
                            Riwayat per kompetensi
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Misi diurutkan dari yang paling lama.
                        </p>
                    </div>
                    <StatusLegend />
                    {missions.length === 0 ? (
                        <p>Siswa ini belum mengirim misi apa pun.</p>
                    ) : (
                        chapters.map((chapter) => (
                            <ChapterHistory
                                key={chapter}
                                classId={classId}
                                studentId={student.id}
                                studentName={student.name}
                                chapter={chapter}
                                missions={missions.filter(
                                    (mission) => mission.chapter === chapter,
                                )}
                            />
                        ))
                    )}
                </section>
            </Card>
            {missions.length > 0 && (
                <Card>
                    <section aria-labelledby="summaries-title">
                        <h2
                            id="summaries-title"
                            className="text-lg font-semibold"
                        >
                            Ringkasan per misi
                        </h2>
                        <ul className="divide-paper-edge divide-y">
                            {missions.map((mission) => (
                                <MissionSummary
                                    key={mission.assignmentId}
                                    classId={classId}
                                    mission={mission}
                                />
                            ))}
                        </ul>
                    </section>
                </Card>
            )}
            {query.data.reviews.length > 0 && (
                <Card>
                    <section
                        aria-labelledby="practice-title"
                        className="space-y-3"
                    >
                        <div className="space-y-1">
                            <h2
                                id="practice-title"
                                className="text-lg font-semibold"
                            >
                                Ulang Yuk
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                Latihan siswa dengan soal misi yang sudah
                                disetujui, pada kompetensi yang masih Berkembang
                                atau Perlu verifikasi. Latihan ini tidak
                                dianalisis AI.
                            </p>
                        </div>
                        <ul className="divide-paper-edge divide-y">
                            {query.data.reviews.map((review) => (
                                <li
                                    key={review.blockId}
                                    className="space-y-1 py-3"
                                >
                                    <p className="font-semibold">
                                        {review.prompt}
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                        {review.mission}
                                    </p>
                                    <ul className="text-sm tabular-nums">
                                        {review.rounds.map((round) => (
                                            <li key={round.at}>
                                                {day.format(new Date(round.at))}
                                                : {round.tries} percobaan,{' '}
                                                {roundResults[round.result]}
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    </section>
                </Card>
            )}
        </div>
    );
}
