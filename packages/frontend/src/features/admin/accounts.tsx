import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { usersQuery, type ManagedRole } from './queries';
import { AccountCreate } from './account-create';
import { AccountRow } from './account-row';
import { StatCard, StatGrid } from '../../components/stat-card';
import { PageHeader } from '../../components/page-header';
import { Pager, usePages } from '../../components/pager';
import { AlertIcon } from '../../components/icons/alert-icon';
import {
    StudentIcon,
    TeacherIcon,
} from '../../components/icons/workspace-icons';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Table, TableHead, TableHeader } from '../../components/ui/table';
import { RequestError } from '../../components/request-error';
const ACCOUNTS_PER_PAGE = 20;

function AccountList({
    role,
    unplacedOnly,
}: {
    role: ManagedRole;
    unplacedOnly: boolean;
}) {
    const query = useQuery(usersQuery(role));
    const [kept, setKept] = useState<number[]>([]);
    const noun = role === 'student' ? 'siswa' : 'guru';
    const shown = unplacedOnly
        ? query.data?.filter(
              ({ id, classroom }) => classroom === null || kept.includes(id),
          )
        : query.data;
    const paged = usePages(shown ?? [], ACCOUNTS_PER_PAGE);
    const count = unplacedOnly
        ? query.data?.filter(({ classroom }) => classroom === null).length
        : query.data?.length;
    return (
        <Card>
            <section aria-labelledby="accounts-title" className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2
                        id="accounts-title"
                        className="font-display text-primary-deep text-xl font-semibold sm:text-2xl"
                    >
                        {unplacedOnly ? 'Siswa tanpa kelas' : `Daftar ${noun}`}
                        {count !== undefined && (
                            <>
                                {' '}
                                <span className="text-muted-foreground ml-1 text-sm font-normal tabular-nums">
                                    {count}
                                </span>
                            </>
                        )}
                    </h2>
                    {unplacedOnly && (
                        <Link
                            to="/admin?role=student"
                            className={buttonVariants({
                                variant: 'outline',
                                className: 'min-h-11 bg-white px-4',
                            })}
                        >
                            Tampilkan semua siswa
                        </Link>
                    )}
                </div>
                {query.isPending ? (
                    <p role="status" className="py-6">
                        Memuat akun…
                    </p>
                ) : query.isError ? (
                    <div className="space-y-3">
                        <RequestError error={query.error} />
                        <Button
                            onClick={() => {
                                void query.refetch();
                            }}
                        >
                            Muat ulang akun
                        </Button>
                    </div>
                ) : !shown || shown.length === 0 ? (
                    <p className="py-6">
                        {unplacedOnly
                            ? 'Semua siswa sudah bergabung ke kelas.'
                            : 'Belum ada akun. Buat satu akun atau impor file Excel melalui formulir di atas.'}
                    </p>
                ) : (
                    <div className="border-paper-edge @container overflow-hidden rounded-lg border">
                        <Table
                            aria-labelledby="accounts-title"
                            className="@max-xl:block"
                        >
                            <TableHeader className="@max-xl:hidden">
                                <tr>
                                    <TableHead scope="col">Nama</TableHead>
                                    {role === 'student' && (
                                        <TableHead scope="col">Kelas</TableHead>
                                    )}
                                    <TableHead
                                        scope="col"
                                        className="text-right"
                                    >
                                        Tindakan
                                    </TableHead>
                                </tr>
                            </TableHeader>
                            <tbody className="@max-xl:block">
                                {paged.shown.map((user) => (
                                    <AccountRow
                                        key={user.id}
                                        user={user}
                                        onClassSave={() =>
                                            setKept((ids) => [...ids, user.id])
                                        }
                                    />
                                ))}
                            </tbody>
                        </Table>
                    </div>
                )}
                <Pager
                    label={`Halaman daftar ${noun}`}
                    page={paged.page}
                    pages={paged.pages}
                    onPage={paged.setPage}
                />
            </section>
        </Card>
    );
}
export function Accounts() {
    const [params] = useSearchParams();
    const role = params.get('role') === 'teacher' ? 'teacher' : 'student';
    const unplacedOnly =
        role === 'student' && params.get('filter') === 'no-class';
    const students = useQuery(usersQuery('student'));
    const teachers = useQuery(usersQuery('teacher'));
    const unplaced = students.data?.filter(
        ({ classroom }) => classroom === null,
    );
    const noun = role === 'student' ? 'siswa' : 'guru';
    return (
        <div className="space-y-6">
            <PageHeader
                title={`Akun ${noun}`}
                description={`Buat akun, bantu akses masuk${role === 'student' ? ', dan atur kelas siswa' : ''}.`}
            />
            {students.data && teachers.data && unplaced && (
                <StatGrid>
                    <li>
                        <StatCard
                            icon={<StudentIcon />}
                            label="Siswa"
                            value={students.data.length}
                            to="/admin?role=student"
                            action="Lihat daftar siswa"
                            note="Akun siswa yang aktif"
                        />
                    </li>
                    <li>
                        <StatCard
                            icon={<TeacherIcon />}
                            label="Guru"
                            value={teachers.data.length}
                            to="/admin?role=teacher"
                            action="Lihat daftar guru"
                            note="Akun guru yang aktif"
                        />
                    </li>
                    <li>
                        <StatCard
                            icon={<AlertIcon />}
                            tone={unplaced.length > 0 ? 'attention' : 'calm'}
                            label="Siswa tanpa kelas"
                            value={unplaced.length}
                            note="Belum bergabung ke kelas mana pun"
                            to={
                                unplaced.length > 0
                                    ? '/admin?role=student&filter=no-class'
                                    : undefined
                            }
                            action="Tampilkan siswanya"
                        />
                    </li>
                </StatGrid>
            )}
            {!unplacedOnly && <AccountCreate key={role} role={role} />}
            <AccountList
                key={`${role}-${unplacedOnly}`}
                role={role}
                unplacedOnly={unplacedOnly}
            />
        </div>
    );
}
