import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router';
import { usersQuery } from './queries';
import { AccountCreate } from './account-create';
import { AccountRow } from './account-row';
import { Button } from '../../components/ui/button';
import { RequestError } from '../../components/request-error';
export function Accounts() {
    const [params] = useSearchParams();
    const role = params.get('role') === 'teacher' ? 'teacher' : 'student';
    const query = useQuery(usersQuery(role));
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Akun sekolah</h1>
                <p className="text-muted-foreground mt-3">
                    Buat akun, bantu akses masuk, dan atur kelas siswa.
                </p>
            </div>
            <nav aria-label="Jenis akun" className="flex gap-3">
                <Link
                    to="/admin?role=student"
                    aria-current={role === 'student' ? 'page' : undefined}
                    className="text-primary aria-[current=page]:bg-secondary min-h-12 rounded-lg px-5 py-3 underline aria-[current=page]:font-bold"
                >
                    Siswa
                </Link>
                <Link
                    to="/admin?role=teacher"
                    aria-current={role === 'teacher' ? 'page' : undefined}
                    className="text-primary aria-[current=page]:bg-secondary min-h-12 rounded-lg px-5 py-3 underline aria-[current=page]:font-bold"
                >
                    Guru
                </Link>
            </nav>
            <AccountCreate key={role} role={role} />
            <section>
                <h2 className="text-xl font-semibold">
                    Daftar {role === 'student' ? 'siswa' : 'guru'}
                </h2>
                {query.isPending ? (
                    <p role="status" className="py-6">
                        Memuat akun…
                    </p>
                ) : query.isError ? (
                    <>
                        <RequestError error={query.error} />
                        <Button
                            onClick={() => {
                                void query.refetch();
                            }}
                        >
                            Muat ulang akun
                        </Button>
                    </>
                ) : query.data.length === 0 ? (
                    <p className="py-6">
                        Belum ada akun. Buat satu akun atau impor file Excel
                        melalui formulir di atas.
                    </p>
                ) : (
                    <ul className="divide-border divide-y">
                        {query.data.map((user) => (
                            <AccountRow key={user.id} user={user} />
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
