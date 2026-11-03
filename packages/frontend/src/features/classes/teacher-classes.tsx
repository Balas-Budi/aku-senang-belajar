import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { classesQuery, useCreateClass } from './queries';
import { Button } from '../../components/ui/button';
import { FormField } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
export function TeacherClasses() {
    const query = useQuery(classesQuery());
    const create = useCreateClass();
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">Kelas yang Anda dampingi</h1>
                <p className="text-muted-foreground mt-3">
                    Buat kelas, bagikan kode, lalu lihat siswa yang bergabung.
                </p>
            </div>
            <form
                className="border-border max-w-xl space-y-4 rounded-xl border p-6"
                onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    create.mutate(
                        String(new FormData(form).get('name') ?? ''),
                        { onSuccess: () => form.reset() },
                    );
                }}
            >
                <h2 className="text-xl font-semibold">Buat kelas</h2>
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
            {query.isPending ? (
                <p role="status">Memuat daftar kelas…</p>
            ) : query.isError ? (
                <>
                    <RequestError error={query.error} />
                    <Button
                        onClick={() => {
                            void query.refetch();
                        }}
                    >
                        Muat ulang kelas
                    </Button>
                </>
            ) : query.data.length === 0 ? (
                <p>
                    Belum ada kelas. Gunakan formulir di atas untuk membuat
                    kelas pertama.
                </p>
            ) : (
                <ul className="divide-border divide-y">
                    {query.data.map((item) => (
                        <li
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-4 py-5"
                        >
                            <div>
                                <Link
                                    to={`/teacher/classes/${item.id}`}
                                    className="text-primary inline-block min-h-12 py-3 text-xl font-semibold underline underline-offset-4"
                                >
                                    {item.name}
                                </Link>
                                <p className="text-muted-foreground">
                                    {item.studentCount} siswa bergabung
                                </p>
                            </div>
                            <p>
                                {item.inviteCode ? (
                                    <>
                                        Kode kelas:{' '}
                                        <strong className="break-all">
                                            {item.inviteCode}
                                        </strong>
                                    </>
                                ) : (
                                    'Pendaftaran ditutup'
                                )}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
