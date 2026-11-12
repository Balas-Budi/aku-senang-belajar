import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { materialsQuery, type Material } from './queries';
import { UploadForm } from './upload-form';
import { subjects } from '../assignments/subject-art';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { textLink } from '../../components/ui/text-link';

export function materialMeta(material: Material) {
    return [
        subjects[material.subject].label,
        material.grade ? `Kelas ${material.grade}` : null,
    ]
        .filter(Boolean)
        .join(' · ');
}

function MaterialList({
    title,
    items,
    empty,
}: {
    title: string;
    items: Material[];
    empty: string;
}) {
    return (
        <section className="space-y-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            {items.length === 0 ? (
                <p className="text-muted-foreground">{empty}</p>
            ) : (
                <div className="@container">
                    <ul className="grid gap-4 @xl:grid-cols-2">
                        {items.map((material) => (
                            <li key={material.id}>
                                <Card className="h-full space-y-1">
                                    <Link
                                        to={`/teacher/materials/${material.id}`}
                                        className={`${textLink} text-lg font-semibold`}
                                    >
                                        {material.title}
                                    </Link>
                                    <p className="text-muted-foreground text-sm">
                                        {materialMeta(material)}
                                    </p>
                                    <p className="text-sm tabular-nums">
                                        {material.prepared
                                            ? 'Disiapkan tim Aku Senang Belajar'
                                            : `${material.readablePages} dari ${material.pageCount} halaman terbaca`}
                                    </p>
                                    {material.archived && (
                                        <p className="pt-1">
                                            <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-sm font-medium">
                                                Diarsipkan
                                            </span>
                                        </p>
                                    )}
                                </Card>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

export function Library() {
    const query = useQuery(materialsQuery());
    const prepared = query.data?.filter((material) => material.prepared);
    const uploads = query.data?.filter((material) => !material.prepared);
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">Materi</h1>
                <p className="text-muted-foreground mt-2">
                    Unggah materi PDF Anda atau buka materi siap pakai.
                </p>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-12">
                <div className="space-y-6 lg:col-span-8">
                    {query.isPending ? (
                        <p role="status">Memuat materi…</p>
                    ) : query.isError ? (
                        <div className="space-y-3">
                            <RequestError error={query.error} />
                            <Button
                                onClick={() => {
                                    void query.refetch();
                                }}
                            >
                                Muat ulang materi
                            </Button>
                        </div>
                    ) : (
                        <>
                            {prepared && prepared.length > 0 && (
                                <MaterialList
                                    title="Materi siap pakai"
                                    items={prepared}
                                    empty=""
                                />
                            )}
                            <MaterialList
                                title="Unggahan Anda"
                                items={uploads ?? []}
                                empty="Belum ada unggahan. PDF yang Anda unggah muncul di sini."
                            />
                        </>
                    )}
                </div>
                <div className="lg:col-span-4">
                    <UploadForm />
                </div>
            </div>
        </div>
    );
}
