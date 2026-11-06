import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { materialMeta } from './library';
import { ModuleForm } from './module-form';
import { materialQuery, pageTextQuery, type MaterialDetail } from './queries';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

function listOf(numbers: number[]) {
    if (numbers.length === 1) return String(numbers[0]);
    return `${numbers.slice(0, -1).join(', ')} dan ${numbers.at(-1)}`;
}

function PageText({
    materialId,
    number,
}: {
    materialId: number;
    number: number;
}) {
    const page = useQuery(pageTextQuery(materialId, number));
    if (page.isPending) return <p role="status">Memuat teks halaman…</p>;
    if (page.isError) return <RequestError error={page.error} />;
    return <p className="whitespace-pre-line">{page.data.text}</p>;
}

function PageRow({
    materialId,
    page,
}: {
    materialId: number;
    page: MaterialDetail['pages'][number];
}) {
    const [open, setOpen] = useState(false);
    if (!page.readable)
        return (
            <li className="py-3">
                <p className="font-semibold">Halaman {page.number}</p>
                <p className="text-muted-foreground text-sm">Tidak terbaca</p>
            </li>
        );
    return (
        <li className="py-1">
            <details
                className="group"
                onToggle={(event) => setOpen(event.currentTarget.open)}
            >
                <summary className="focus-visible:outline-ring cursor-pointer rounded py-2.5 focus-visible:outline-3">
                    <span className="font-semibold">Halaman {page.number}</span>
                    <span className="text-muted-foreground line-clamp-2 text-sm group-open:hidden">
                        {page.snippet}
                    </span>
                </summary>
                <div className="pb-3">
                    {open && (
                        <PageText
                            materialId={materialId}
                            number={page.number}
                        />
                    )}
                </div>
            </details>
        </li>
    );
}

export function MaterialDetailView({ id }: { id: number }) {
    const query = useQuery(materialQuery(id));
    if (query.isPending) return <p role="status">Memuat materi…</p>;
    if (query.isError)
        return (
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
        );
    const material = query.data;
    const unreadable = material.pages
        .filter((page) => !page.readable)
        .map((page) => page.number);
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold">{material.title}</h1>
                <p className="text-muted-foreground mt-2 tabular-nums">
                    {materialMeta(material)} ·{' '}
                    {material.prepared
                        ? 'Disiapkan tim Aku Senang Belajar'
                        : `${material.readablePages} dari ${material.pageCount} halaman terbaca`}
                </p>
            </div>
            {unreadable.length > 0 && (
                <Alert tone="attention">
                    <p className="font-semibold">
                        {unreadable.length} halaman tidak terbaca
                    </p>
                    <p className="mt-1">
                        Halaman {listOf(unreadable)} tidak punya teks yang bisa
                        dibaca, mungkin hasil pindai. Halaman itu tidak dipakai
                        untuk menyusun sesi. Bila isinya penting, unggah PDF
                        yang teksnya bisa dipilih.
                    </p>
                </Alert>
            )}
            {material.modules.length > 0 && (
                <Card>
                    <section
                        aria-labelledby="modules-title"
                        className="space-y-3"
                    >
                        <h2
                            id="modules-title"
                            className="text-lg font-semibold"
                        >
                            Modul
                        </h2>
                        <ul className="divide-paper-edge divide-y">
                            {material.modules.map((module) => (
                                <li key={module.id} className="space-y-2 py-3">
                                    <div>
                                        <p className="font-semibold">
                                            {module.title}
                                        </p>
                                        {module.firstPage !== null && (
                                            <p className="text-muted-foreground text-sm tabular-nums">
                                                Halaman {module.firstPage}{' '}
                                                sampai {module.lastPage}
                                            </p>
                                        )}
                                    </div>
                                    {module.competencies.length > 0 && (
                                        <ul className="space-y-1 text-sm">
                                            {module.competencies.map(
                                                (competency) => (
                                                    <li key={competency.id}>
                                                        <span className="font-semibold">
                                                            {competency.code}
                                                        </span>{' '}
                                                        {competency.description}
                                                        {competency.pages
                                                            .length > 0 && (
                                                            <span className="text-muted-foreground tabular-nums">
                                                                {' '}
                                                                · Hal.{' '}
                                                                {competency.pages.join(
                                                                    ', ',
                                                                )}
                                                            </span>
                                                        )}
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    )}
                                    {module.sessions.map((session) => (
                                        <p key={session.id} className="text-sm">
                                            {session.title}{' '}
                                            <span className="text-muted-foreground">
                                                ·{' '}
                                                {session.status === 'ready'
                                                    ? 'Siap ditugaskan'
                                                    : 'Draf'}
                                            </span>
                                        </p>
                                    ))}
                                </li>
                            ))}
                        </ul>
                    </section>
                </Card>
            )}
            {!material.prepared && material.readablePages > 0 && (
                <ModuleForm
                    materialId={material.id}
                    pageCount={material.pageCount}
                />
            )}
            {material.pages.length > 0 && (
                <Card>
                    <section
                        aria-labelledby="pages-title"
                        className="space-y-2"
                    >
                        <h2 id="pages-title" className="text-lg font-semibold">
                            Halaman{' '}
                            <span className="text-muted-foreground ml-1 text-sm font-normal tabular-nums">
                                {material.pageCount}
                            </span>
                        </h2>
                        <ul className="divide-paper-edge divide-y">
                            {material.pages.map((page) => (
                                <PageRow
                                    key={page.number}
                                    materialId={material.id}
                                    page={page}
                                />
                            ))}
                        </ul>
                    </section>
                </Card>
            )}
        </div>
    );
}
