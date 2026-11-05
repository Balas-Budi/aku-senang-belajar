import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { RequestError } from '../../components/request-error';
import { StatCard, StatGrid } from '../../components/stat-card';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import {
    Table,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../components/ui/table';
import { cellLink, textLink } from '../../components/ui/text-link';
import { classesQuery } from '../classes/queries';
import { teacherOverviewQuery } from './queries';
import { reviewLabel } from './status';

const linkStyle = `${textLink} font-medium`;

function YourClasses() {
    const classes = useQuery(classesQuery());

    return (
        <section aria-labelledby="classes-title" className="space-y-2">
            <h2 id="classes-title" className="text-lg font-semibold">
                Kelas Anda
            </h2>
            {classes.data && classes.data.length > 0 ? (
                <ul className="divide-paper-edge divide-y">
                    {classes.data.map((classroom) => (
                        <li
                            key={classroom.id}
                            className="flex items-center justify-between gap-3 py-3"
                        >
                            <Link
                                to={`/teacher/classes/${classroom.id}`}
                                className={linkStyle}
                            >
                                {classroom.name}
                            </Link>
                            <span className="text-muted-foreground text-sm tabular-nums">
                                {classroom.studentCount} siswa
                            </span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>Belum ada kelas.</p>
            )}
            <Link
                to="/teacher/classes"
                className={buttonVariants({ variant: 'outline' })}
            >
                Kelola kelas
            </Link>
        </section>
    );
}

export function TeacherHome() {
    const overview = useQuery(teacherOverviewQuery());

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">Beranda</h1>
                <p className="text-muted-foreground mt-2">
                    Yang perlu Anda perhatikan dari misi kelas.
                </p>
            </div>
            {overview.isPending ? (
                <p role="status">Memuat ringkasan…</p>
            ) : overview.isError ? (
                <div className="space-y-3">
                    <RequestError error={overview.error} />
                    <Button
                        onClick={() => {
                            void overview.refetch();
                        }}
                    >
                        Muat ulang ringkasan
                    </Button>
                </div>
            ) : (
                <>
                    <StatGrid>
                        <li>
                            <StatCard
                                label="Perlu verifikasi"
                                value={overview.data.needsVerification}
                                note="Kompetensi yang perlu Anda tanyakan langsung kepada siswa"
                            />
                        </li>
                        <li>
                            <StatCard
                                label="Belum diperiksa"
                                value={overview.data.unreviewed}
                                note="Saran AI yang belum Anda tinjau"
                            />
                        </li>
                        <li>
                            <StatCard
                                label="Menunggu analisis"
                                value={overview.data.waiting}
                                note="Misi terkirim yang analisisnya gagal atau belum berjalan"
                            />
                        </li>
                    </StatGrid>
                    <div className="grid items-start gap-6 lg:grid-cols-12">
                        <Card className="lg:col-span-8">
                            <section
                                aria-labelledby="checks-title"
                                className="space-y-2"
                            >
                                <h2
                                    id="checks-title"
                                    className="text-lg font-semibold"
                                >
                                    Perlu verifikasi
                                </h2>
                                {overview.data.checks.length === 0 ? (
                                    <p>
                                        Tidak ada kompetensi yang perlu
                                        diverifikasi saat ini.
                                    </p>
                                ) : (
                                    <ul className="divide-paper-edge divide-y">
                                        {overview.data.checks.map((check) => (
                                            <li
                                                key={`${check.assignmentId}-${check.studentId}-${check.competencyCode}`}
                                                className="flex flex-wrap items-center justify-between gap-3 py-3"
                                            >
                                                <div>
                                                    <p className="font-semibold">
                                                        {check.studentName} ·{' '}
                                                        {check.competencyCode}
                                                    </p>
                                                    <p className="text-muted-foreground text-sm">
                                                        {check.className} ·{' '}
                                                        {check.missionTitle} ·{' '}
                                                        {reviewLabel(
                                                            check.decision,
                                                        )}
                                                    </p>
                                                </div>
                                                <Link
                                                    to={`/teacher/classes/${check.classId}/sessions/${check.assignmentId}/students/${check.studentId}#kompetensi-${check.competencyCode}`}
                                                    aria-label={`Lihat bukti ${check.studentName} untuk ${check.competencyCode}`}
                                                    className={buttonVariants({
                                                        variant: 'outline',
                                                    })}
                                                >
                                                    Lihat bukti
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </Card>
                        <Card className="lg:col-span-4">
                            <YourClasses />
                        </Card>
                    </div>
                    <Card>
                        <section
                            aria-labelledby="missions-title"
                            className="space-y-3"
                        >
                            <h2
                                id="missions-title"
                                className="text-lg font-semibold"
                            >
                                Misi yang sudah dikirim siswa
                            </h2>
                            {overview.data.missions.length === 0 ? (
                                <p>Belum ada misi yang dikirim siswa.</p>
                            ) : (
                                <div
                                    role="region"
                                    aria-label="Tabel misi"
                                    tabIndex={0}
                                    className="border-paper-edge focus-visible:outline-ring relative overflow-x-auto rounded-lg border focus-visible:outline-3"
                                >
                                    <Table className="min-w-[44rem]">
                                        <TableHeader>
                                            <tr>
                                                <TableHead scope="col">
                                                    Misi
                                                </TableHead>
                                                <TableHead
                                                    scope="col"
                                                    className="text-right"
                                                >
                                                    Terkirim
                                                </TableHead>
                                                <TableHead
                                                    scope="col"
                                                    className="text-right"
                                                >
                                                    Perlu verifikasi
                                                </TableHead>
                                                <TableHead
                                                    scope="col"
                                                    className="text-right"
                                                >
                                                    Belum diperiksa
                                                </TableHead>
                                                <TableHead
                                                    scope="col"
                                                    className="text-right"
                                                >
                                                    Menunggu analisis
                                                </TableHead>
                                                <TableHead scope="col">
                                                    <span className="sr-only">
                                                        Hasil
                                                    </span>
                                                </TableHead>
                                            </tr>
                                        </TableHeader>
                                        <tbody>
                                            {overview.data.missions.map(
                                                (mission) => (
                                                    <TableRow
                                                        key={`${mission.classId}-${mission.assignmentId}`}
                                                    >
                                                        <th
                                                            scope="row"
                                                            className="px-4 py-3 text-left font-normal"
                                                        >
                                                            <span className="block font-semibold">
                                                                {mission.title}
                                                            </span>
                                                            <span className="text-muted-foreground block">
                                                                {
                                                                    mission.className
                                                                }
                                                            </span>
                                                        </th>
                                                        <TableCell className="text-right tabular-nums">
                                                            {mission.submitted}{' '}
                                                            dari{' '}
                                                            {mission.students}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {
                                                                mission.needsVerification
                                                            }
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {mission.unreviewed}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums">
                                                            {mission.waiting}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Link
                                                                to={`/teacher/classes/${mission.classId}/sessions/${mission.assignmentId}`}
                                                                aria-label={`Lihat hasil ${mission.title} di ${mission.className}`}
                                                                className={`${cellLink} font-medium`}
                                                            >
                                                                Lihat hasil
                                                            </Link>
                                                        </TableCell>
                                                    </TableRow>
                                                ),
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            )}
                        </section>
                    </Card>
                </>
            )}
        </div>
    );
}
