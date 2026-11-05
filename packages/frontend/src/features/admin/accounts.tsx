import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { usersQuery, type ManagedRole } from './queries';
import { AccountCreate } from './account-create';
import { AccountRow } from './account-row';
import { StatCard, StatGrid } from '../../components/stat-card';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Table, TableHead, TableHeader } from '../../components/ui/table';
import { RequestError } from '../../components/request-error';
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
    const count = unplacedOnly
        ? query.data?.filter(({ classroom }) => classroom === null).length
        : query.data?.length;
    return (
        <Card>
            <section aria-labelledby="accounts-title" className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h2 id="accounts-title" className="text-lg font-semibold">
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
                            className="text-primary focus-visible:outline-ring inline-block min-h-11 rounded py-2 underline underline-offset-4 focus-visible:outline-3"
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
                                {shown.map((user) => (
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
            <div>
                <h1 className="text-2xl font-semibold">Akun {noun}</h1>
                <p className="text-muted-foreground mt-2">
                    Buat akun, bantu akses masuk
                    {role === 'student' ? ', dan atur kelas siswa' : ''}.
                </p>
            </div>
            {students.data && teachers.data && unplaced && (
                <StatGrid>
                    <li>
                        <StatCard
                            label="Siswa"
                            value={students.data.length}
                            note="Akun siswa yang aktif"
                        />
                    </li>
                    <li>
                        <StatCard
                            label="Guru"
                            value={teachers.data.length}
                            note="Akun guru yang aktif"
                        />
                    </li>
                    <li>
                        <StatCard
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
