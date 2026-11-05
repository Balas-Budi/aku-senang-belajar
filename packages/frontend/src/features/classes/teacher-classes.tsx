import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { classesQuery, useCreateClass } from './queries';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { textLink } from '../../components/ui/text-link';
import { FormField } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
export function TeacherClasses() {
    const query = useQuery(classesQuery());
    const create = useCreateClass();
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">
                    Kelas yang Anda dampingi
                </h1>
                <p className="text-muted-foreground mt-2">
                    Buat kelas, bagikan kode, lalu lihat siswa yang bergabung.
                </p>
            </div>
            {query.isPending ? (
                <p role="status">Memuat daftar kelas…</p>
            ) : query.isError ? (
                <div className="space-y-3">
                    <RequestError error={query.error} />
                    <Button
                        onClick={() => {
                            void query.refetch();
                        }}
                    >
                        Muat ulang kelas
                    </Button>
                </div>
            ) : query.data.length === 0 ? (
                <Card>
                    <p>
                        Belum ada kelas. Gunakan formulir di bawah untuk membuat
                        kelas pertama.
                    </p>
                </Card>
            ) : (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {query.data.map((item) => (
                        <li key={item.id}>
                            <Card className="h-full space-y-2">
                                <Link
                                    to={`/teacher/classes/${item.id}`}
                                    className={`${textLink} text-lg font-semibold`}
                                >
                                    {item.name}
                                </Link>
                                <p>
                                    <span className="font-semibold tabular-nums">
                                        {item.studentCount}
                                    </span>{' '}
                                    siswa bergabung
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {item.inviteCode ? (
                                        <>
                                            Kode kelas:{' '}
                                            <strong className="text-foreground break-all">
                                                {item.inviteCode}
                                            </strong>
                                        </>
                                    ) : (
                                        'Pendaftaran ditutup'
                                    )}
                                </p>
                            </Card>
                        </li>
                    ))}
                </ul>
            )}
            <Card className="max-w-xl">
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        create.mutate(
                            String(new FormData(form).get('name') ?? ''),
                            { onSuccess: () => form.reset() },
                        );
                    }}
                >
                    <h2 className="text-lg font-semibold">Buat kelas</h2>
                    <FormField
                        name="name"
                        label="Nama kelas"
                        required
                        error={create.error}
                    />
                    <RequestError error={create.error} />
                    <Button type="submit" disabled={create.isPending}>
                        {create.isPending ? 'Membuat kelas…' : 'Buat kelas'}
                    </Button>
                </form>
            </Card>
        </div>
    );
}
