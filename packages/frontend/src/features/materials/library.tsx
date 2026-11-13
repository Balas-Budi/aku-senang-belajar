import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { materialsQuery, pagesRead, type Material } from './queries';
import { MaterialFilters, useMaterialFilters } from './material-filters';
import { UploadButton } from './upload-form';
import { SubjectArt, subjects } from '../assignments/subject-art';
import { PageHeader } from '../../components/page-header';
import { ArrowRightIcon } from '../../components/icons/arrow-icon';
import { RequestError } from '../../components/request-error';
import { Button } from '../../components/ui/button';

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
            <h2 className="font-display text-primary-deep text-xl font-semibold sm:text-2xl">
                {title}
            </h2>
            {items.length === 0 ? (
                <p className="text-muted-foreground">{empty}</p>
            ) : (
                <div className="@container">
                    <ul className="grid gap-4 @xl:grid-cols-2">
                        {items.map((material) => (
                            <li key={material.id}>
                                <Link
                                    to={`/teacher/materials/${material.id}`}
                                    className="border-paper-edge hover:border-primary focus-visible:outline-ring flex h-full items-start gap-4 rounded-[20px] border bg-white p-5 shadow-[0_1px_2px_rgb(28_22_96/0.05),0_8px_24px_-12px_rgb(28_22_96/0.12)] transition-colors focus-visible:outline-3"
                                >
                                    <SubjectArt
                                        subject={material.subject}
                                        className="size-14"
                                    />
                                    <span className="min-w-0 flex-1 space-y-1">
                                        <span className="font-display text-primary-deep block text-xl leading-tight font-semibold break-words">
                                            {material.title}
                                        </span>
                                        <span className="text-muted-foreground block text-sm">
                                            {materialMeta(material)}
                                        </span>
                                        <span className="block text-sm tabular-nums">
                                            {material.prepared
                                                ? 'Disiapkan tim Aku Senang Belajar'
                                                : pagesRead(material)}
                                        </span>
                                        {material.archived && (
                                            <span className="bg-muted text-muted-foreground mt-1 inline-block rounded-full px-3 py-0.5 text-sm font-semibold">
                                                Diarsipkan
                                            </span>
                                        )}
                                    </span>
                                    <ArrowRightIcon className="text-primary mt-1 size-5 shrink-0" />
                                </Link>
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
    const { filters, update, active, matches } = useMaterialFilters();
    const shown = query.data?.filter(matches);
    const prepared = shown?.filter((material) => material.prepared);
    const uploads = shown?.filter((material) => !material.prepared);
    return (
        <div className="space-y-6">
            <PageHeader
                title="Materi"
                description="Unggah buku PDF Anda atau buka materi siap pakai."
            >
                <UploadButton />
            </PageHeader>
            <div className="space-y-6">
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
                        <MaterialFilters filters={filters} update={update} />
                        {active && shown?.length === 0 ? (
                            <div className="border-paper-edge space-y-3 rounded-[20px] border border-dashed p-6 text-center">
                                <p
                                    role="status"
                                    className="text-lg font-semibold"
                                >
                                    Tidak ada materi yang cocok.
                                </p>
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        update({
                                            text: '',
                                            subject: '',
                                            grade: '',
                                        })
                                    }
                                >
                                    Hapus filter
                                </Button>
                            </div>
                        ) : null}
                        {prepared && prepared.length > 0 && (
                            <MaterialList
                                title="Materi siap pakai"
                                items={prepared}
                                empty=""
                            />
                        )}
                        {(!active || (uploads && uploads.length > 0)) && (
                            <MaterialList
                                title="Unggahan Anda"
                                items={uploads ?? []}
                                empty="Belum ada unggahan. Tekan Unggah buku PDF di atas untuk menambah buku."
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
