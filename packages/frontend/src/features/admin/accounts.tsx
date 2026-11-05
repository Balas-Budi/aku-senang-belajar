import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { usersQuery } from './queries';
import { AccountCreate } from './account-create';
import { AccountRow } from './account-row';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { RequestError } from '../../components/request-error';
export function Accounts() {
    const [params] = useSearchParams();
    const role = params.get('role') === 'teacher' ? 'teacher' : 'student';
    const query = useQuery(usersQuery(role));
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
            <AccountCreate key={role} role={role} />
            <Card>
                <section aria-labelledby="accounts-title">
                    <h2 id="accounts-title" className="text-lg font-semibold">
                        Daftar {noun}
                        {query.data && (
                            <span className="text-muted-foreground ml-2 text-sm font-normal tabular-nums">
                                {query.data.length}
                            </span>
                        )}
                    </h2>
                    {query.isPending ? (
                        <p role="status" className="py-6">
                            Memuat akun…
                        </p>
                    ) : query.isError ? (
                        <div className="space-y-3 pt-3">
                            <RequestError error={query.error} />
                            <Button
                                onClick={() => {
                                    void query.refetch();
                                }}
                            >
                                Muat ulang akun
                            </Button>
                        </div>
                    ) : query.data.length === 0 ? (
                        <p className="py-6">
                            Belum ada akun. Buat satu akun atau impor file Excel
                            melalui formulir di atas.
                        </p>
                    ) : (
                        <ul className="divide-paper-edge divide-y">
                            {query.data.map((user) => (
                                <AccountRow key={user.id} user={user} />
                            ))}
                        </ul>
                    )}
                </section>
            </Card>
        </div>
    );
}
