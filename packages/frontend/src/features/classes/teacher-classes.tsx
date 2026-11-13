import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { classesQuery, useCreateClass } from './queries';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { PageHeader } from '../../components/page-header';
import { SectionTitle } from '../../components/section-title';
import { ArrowRightIcon } from '../../components/icons/arrow-icon';
import { ClassIcon, PlusIcon } from '../../components/icons/workspace-icons';
import { FormField } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
export function TeacherClasses() {
    const query = useQuery(classesQuery());
    const create = useCreateClass();
    return (
        <div className="space-y-6">
            <PageHeader
                title="Kelas yang Anda dampingi"
                description="Buat kelas, bagikan kode, lalu lihat siswa yang bergabung."
            />
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
                            <Link
                                to={`/teacher/classes/${item.id}`}
                                className="border-paper-edge hover:border-primary focus-visible:outline-ring flex h-full flex-col gap-4 rounded-[20px] border bg-white p-5 shadow-[0_1px_2px_rgb(28_22_96/0.05),0_8px_24px_-12px_rgb(28_22_96/0.12)] transition-colors focus-visible:outline-3"
                            >
                                <span className="flex items-center gap-3">
                                    <span
                                        aria-hidden="true"
                                        className="bg-secondary text-primary-deep flex size-12 shrink-0 items-center justify-center rounded-xl"
                                    >
                                        <ClassIcon />
                                    </span>
                                    <span className="font-display text-primary-deep min-w-0 flex-1 text-2xl leading-tight font-semibold break-words">
                                        {item.name}
                                    </span>
                                    <ArrowRightIcon className="text-primary size-5 shrink-0" />
                                </span>
                                <span className="flex flex-wrap gap-2">
                                    <span className="bg-student-surface text-primary-deep rounded-full px-3 py-1 text-sm font-semibold">
                                        {item.studentCount} siswa
                                    </span>
                                    <span className="bg-student-surface text-primary-deep rounded-full px-3 py-1 text-sm font-semibold">
                                        {item.inviteCode
                                            ? `Kode ${item.inviteCode}`
                                            : 'Pendaftaran ditutup'}
                                    </span>
                                </span>
                            </Link>
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
                    <SectionTitle icon={<PlusIcon />}>
                        Buat kelas baru
                    </SectionTitle>
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
