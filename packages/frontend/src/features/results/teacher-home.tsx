import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AlertIcon } from '../../components/icons/alert-icon';
import { ArrowRightIcon } from '../../components/icons/arrow-icon';
import { CheckIcon } from '../../components/icons/check-icon';
import {
    ClassIcon,
    HourglassIcon,
    SendIcon,
    SparkleIcon,
} from '../../components/icons/workspace-icons';
import { PageHeader } from '../../components/page-header';
import { Pager, usePages } from '../../components/pager';
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
import { cn } from '../../lib/cn';
import { meQuery } from '../auth/queries';
import { classesQuery } from '../classes/queries';
import { teacherOverviewQuery, type TeacherOverview } from './queries';
import { reviewLabel } from './status';

const rowButton = buttonVariants({
    variant: 'outline',
    className: 'min-h-11 shrink-0 bg-white px-4',
});

function greetingFor(hour: number) {
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
}

/** Time of day is the reader's own, so it is set after hydration. */
function useGreeting() {
    const [greeting, setGreeting] = useState('Halo');
    useEffect(() => {
        setGreeting(greetingFor(new Date().getHours()));
    }, []);
    return greeting;
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
    return (
        <h2
            id={id}
            className="font-display text-primary-deep text-xl font-semibold sm:text-2xl"
        >
            {children}
        </h2>
    );
}

type Todo = {
    key: string;
    tone: 'attention' | 'ai' | 'waiting';
    title: string;
    detail: string;
    to: string;
    action: string;
    label: string;
};

const todoTiles = {
    attention: {
        tile: 'bg-status-verify-soft text-status-verify',
        icon: <AlertIcon />,
    },
    ai: { tile: 'bg-secondary text-ai-suggestion', icon: <SparkleIcon /> },
    waiting: {
        tile: 'bg-activity-blue/12 text-[#00609a]',
        icon: <HourglassIcon />,
    },
};

function todosOf(overview: TeacherOverview): Todo[] {
    const results = (mission: TeacherOverview['missions'][number]) =>
        `/teacher/classes/${mission.classId}/sessions/${mission.assignmentId}`;
    return [
        ...overview.checks.map((check) => ({
            key: `check-${check.assignmentId}-${check.studentId}-${check.competencyCode}`,
            tone: 'attention' as const,
            title: `${check.studentName} · ${check.competencyCode} perlu diverifikasi`,
            detail: `${check.className} · ${check.missionTitle} · ${reviewLabel(check.decision)}`,
            to: `/teacher/classes/${check.classId}/sessions/${check.assignmentId}/students/${check.studentId}#kompetensi-${check.competencyCode}`,
            action: 'Lihat bukti',
            label: `Lihat bukti ${check.studentName} untuk ${check.competencyCode}`,
        })),
        ...overview.missions
            .filter(({ unreviewed }) => unreviewed > 0)
            .map((mission) => ({
                key: `ai-${mission.classId}-${mission.assignmentId}`,
                tone: 'ai' as const,
                title: `${mission.unreviewed} saran AI belum Anda periksa`,
                detail: `${mission.className} · ${mission.title}`,
                to: results(mission),
                action: 'Periksa',
                label: `Periksa saran AI ${mission.title} di ${mission.className}`,
            })),
        ...overview.missions
            .filter(({ waiting }) => waiting > 0)
            .map((mission) => ({
                key: `wait-${mission.classId}-${mission.assignmentId}`,
                tone: 'waiting' as const,
                title: `${mission.waiting} kiriman menunggu analisis`,
                detail: `${mission.className} · ${mission.title}`,
                to: results(mission),
                action: 'Lihat hasil',
                label: `Lihat hasil ${mission.title} di ${mission.className}`,
            })),
    ];
}

function TodoList({ todos }: { todos: Todo[] }) {
    if (todos.length === 0)
        return (
            <p className="bg-status-visible/8 text-status-visible flex items-center gap-3 rounded-2xl p-4 text-base font-semibold">
                <CheckIcon className="size-6" />
                Semua sudah beres. Tidak ada yang perlu dicek sekarang.
            </p>
        );
    return (
        <ul className="space-y-3">
            {todos.map((todo) => (
                <li
                    key={todo.key}
                    className="border-paper-edge bg-student-surface/60 flex flex-wrap items-center gap-3 rounded-2xl border p-3 sm:flex-nowrap sm:p-4"
                >
                    <span
                        aria-hidden="true"
                        className={cn(
                            'flex size-11 shrink-0 items-center justify-center rounded-xl',
                            todoTiles[todo.tone].tile,
                        )}
                    >
                        {todoTiles[todo.tone].icon}
                    </span>
                    <span className="min-w-0 flex-1 basis-48">
                        <span className="block text-base font-semibold break-words">
                            {todo.title}
                        </span>
                        <span className="text-muted-foreground block text-sm break-words">
                            {todo.detail}
                        </span>
                    </span>
                    <Link
                        to={todo.to}
                        aria-label={todo.label}
                        className={cn(rowButton, 'w-full sm:w-auto')}
                    >
                        {todo.action}
                        <ArrowRightIcon className="size-4" />
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function YourClasses() {
    const classes = useQuery(classesQuery());

    return (
        <section aria-labelledby="classes-title" className="space-y-4">
            <SectionTitle id="classes-title">Kelas Anda</SectionTitle>
            {classes.data && classes.data.length > 0 ? (
                <ul className="space-y-2">
                    {classes.data.map((classroom) => (
                        <li key={classroom.id}>
                            <Link
                                to={`/teacher/classes/${classroom.id}`}
                                className="border-paper-edge hover:border-primary hover:bg-student-surface focus-visible:outline-ring flex items-center gap-3 rounded-2xl border p-3 transition-colors focus-visible:outline-3"
                            >
                                <span
                                    aria-hidden="true"
                                    className="bg-secondary text-primary-deep flex size-11 shrink-0 items-center justify-center rounded-xl"
                                >
                                    <ClassIcon />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="text-primary-deep block text-base font-semibold break-words">
                                        {classroom.name}
                                    </span>
                                    <span className="text-muted-foreground block text-sm">
                                        {classroom.studentCount} siswa
                                        {classroom.inviteCode &&
                                            ` · Kode ${classroom.inviteCode}`}
                                    </span>
                                </span>
                                <ArrowRightIcon className="text-primary size-5" />
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>Belum ada kelas. Buat kelas pertama Anda.</p>
            )}
            <Link
                to="/teacher/classes"
                className={buttonVariants({
                    variant: 'outline',
                    className: 'w-full',
                })}
            >
                Kelola kelas
            </Link>
        </section>
    );
}

function Counts({ mission }: { mission: TeacherOverview['missions'][number] }) {
    const chips = [
        mission.needsVerification > 0 && {
            text: `${mission.needsVerification} perlu verifikasi`,
            style: 'bg-status-verify-soft text-status-verify',
        },
        mission.unreviewed > 0 && {
            text: `${mission.unreviewed} saran AI`,
            style: 'bg-secondary text-ai-suggestion',
        },
        mission.waiting > 0 && {
            text: `${mission.waiting} menunggu analisis`,
            style: 'bg-activity-blue/12 text-[#00609a]',
        },
    ].filter((chip) => chip !== false);
    return (
        <span className="flex flex-wrap gap-2">
            {chips.map((chip) => (
                <span
                    key={chip.text}
                    className={cn(
                        'rounded-full px-3 py-1 text-sm font-semibold',
                        chip.style,
                    )}
                >
                    {chip.text}
                </span>
            ))}
        </span>
    );
}

const MISSIONS_PER_PAGE = 5;

function Missions({
    missions: all,
}: {
    missions: TeacherOverview['missions'];
}) {
    const {
        page,
        pages,
        setPage,
        shown: missions,
    } = usePages(all, MISSIONS_PER_PAGE);
    const resultsOf = (mission: TeacherOverview['missions'][number]) =>
        `/teacher/classes/${mission.classId}/sessions/${mission.assignmentId}`;
    if (all.length === 0) return <p>Belum ada misi yang dikirim siswa.</p>;
    return (
        <>
            <ul className="space-y-3 md:hidden">
                {missions.map((mission) => (
                    <li
                        key={`${mission.classId}-${mission.assignmentId}`}
                        className="border-paper-edge space-y-3 rounded-2xl border p-4"
                    >
                        <span className="block">
                            <span className="block text-base font-semibold break-words">
                                {mission.title}
                            </span>
                            <span className="text-muted-foreground block text-sm">
                                {mission.className} · {mission.submitted} dari{' '}
                                {mission.students} siswa mengirim
                            </span>
                        </span>
                        <Counts mission={mission} />
                        <Link
                            to={resultsOf(mission)}
                            aria-label={`Lihat hasil ${mission.title} di ${mission.className}`}
                            className={cn(rowButton, 'w-full')}
                        >
                            Lihat hasil
                            <ArrowRightIcon className="size-4" />
                        </Link>
                    </li>
                ))}
            </ul>
            <div
                role="region"
                aria-label="Tabel misi"
                tabIndex={0}
                className="border-paper-edge focus-visible:outline-ring relative hidden overflow-x-auto rounded-2xl border focus-visible:outline-3 md:block"
            >
                <Table className="min-w-[44rem]">
                    <TableHeader>
                        <tr>
                            <TableHead scope="col">Misi</TableHead>
                            <TableHead scope="col" className="text-right">
                                Terkirim
                            </TableHead>
                            <TableHead scope="col">Perlu perhatian</TableHead>
                            <TableHead scope="col">
                                <span className="sr-only">Hasil</span>
                            </TableHead>
                        </tr>
                    </TableHeader>
                    <tbody>
                        {missions.map((mission) => (
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
                                    <span className="text-muted-foreground block text-sm">
                                        {mission.className}
                                    </span>
                                </th>
                                <TableCell className="text-right whitespace-nowrap tabular-nums">
                                    {mission.submitted} dari {mission.students}
                                </TableCell>
                                <TableCell>
                                    {mission.needsVerification +
                                        mission.unreviewed +
                                        mission.waiting ===
                                    0 ? (
                                        <span className="text-muted-foreground">
                                            Beres
                                        </span>
                                    ) : (
                                        <Counts mission={mission} />
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Link
                                        to={resultsOf(mission)}
                                        aria-label={`Lihat hasil ${mission.title} di ${mission.className}`}
                                        className={rowButton}
                                    >
                                        Lihat hasil
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </tbody>
                </Table>
            </div>
            <Pager
                label="Halaman misi"
                page={page}
                pages={pages}
                onPage={setPage}
            />
        </>
    );
}

export function TeacherHome() {
    const overview = useQuery(teacherOverviewQuery());
    const { data: user } = useQuery(meQuery());
    const greeting = useGreeting();
    const firstName = user?.name.trim().split(/\s+/)[0];
    const todos = overview.data ? todosOf(overview.data) : [];

    return (
        <div className="space-y-6">
            <PageHeader
                title={
                    firstName
                        ? `${greeting}, Pak/Bu ${firstName}`
                        : `${greeting}!`
                }
                description={
                    !overview.data
                        ? 'Ringkasan misi kelas Anda.'
                        : todos.length === 0
                          ? 'Semua sudah beres hari ini.'
                          : `Ada ${todos.length} hal yang perlu Anda cek.`
                }
            />
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
                <div className="grid items-start gap-6 lg:grid-cols-12 [&>*]:min-w-0">
                    <Card className="order-1 lg:order-2 lg:col-span-8">
                        <section
                            id="perlu-dicek"
                            aria-labelledby="todo-title"
                            className="scroll-mt-6 space-y-4"
                        >
                            <SectionTitle id="todo-title">
                                Perlu dicek sekarang
                            </SectionTitle>
                            <TodoList todos={todos} />
                        </section>
                    </Card>
                    <section
                        aria-label="Ringkasan"
                        className="order-2 lg:order-1 lg:col-span-12"
                    >
                        <StatGrid>
                            <li>
                                <StatCard
                                    tone="attention"
                                    icon={<AlertIcon />}
                                    label="Perlu verifikasi"
                                    value={overview.data.needsVerification}
                                    note="Kompetensi yang perlu Anda tanyakan langsung kepada siswa"
                                    to="#perlu-dicek"
                                    action="Lihat daftarnya"
                                />
                            </li>
                            <li>
                                <StatCard
                                    tone="ai"
                                    icon={<SparkleIcon />}
                                    label="Saran AI"
                                    value={overview.data.unreviewed}
                                    note="Saran AI yang belum Anda periksa"
                                    to="#perlu-dicek"
                                    action="Lihat daftarnya"
                                />
                            </li>
                            <li>
                                <StatCard
                                    tone="waiting"
                                    icon={<HourglassIcon />}
                                    label="Menunggu analisis"
                                    value={overview.data.waiting}
                                    note="Kiriman yang analisisnya gagal atau belum berjalan"
                                    to="#misi-terkirim"
                                    action="Lihat misinya"
                                />
                            </li>
                        </StatGrid>
                    </section>
                    <Card className="order-3 lg:col-span-4">
                        <YourClasses />
                    </Card>
                    <Card className="order-4 lg:col-span-12">
                        <section
                            id="misi-terkirim"
                            aria-labelledby="missions-title"
                            className="scroll-mt-6 space-y-4"
                        >
                            <div className="flex items-center gap-3">
                                <span
                                    aria-hidden="true"
                                    className="bg-secondary text-primary-deep flex size-11 shrink-0 items-center justify-center rounded-xl"
                                >
                                    <SendIcon />
                                </span>
                                <SectionTitle id="missions-title">
                                    Misi yang sudah dikirim siswa
                                </SectionTitle>
                            </div>
                            <Missions missions={overview.data.missions} />
                        </section>
                    </Card>
                </div>
            )}
        </div>
    );
}
