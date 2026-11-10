import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { materialMeta } from './library';
import { ModuleForm } from './module-form';
import { materialQuery, pageTextQuery, type MaterialDetail } from './queries';
import { fieldErrorText } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { textLink } from '../../components/ui/text-link';
import { useCreateSession } from '../studio/queries';
import { choiceBox, choiceCard } from '../studio/studio-labels';
import { StudioError } from '../studio/studio-error';

type Module = MaterialDetail['modules'][number];

function sessionState(session: Module['sessions'][number]) {
    if (session.drafting === 'generating') return 'Sedang disusun AI';
    if (session.drafting === 'failed') return 'Penyusunan terakhir gagal';
    return session.status === 'ready' ? 'Siap ditugaskan' : 'Draf';
}

function NewSession({
    module,
    uncovered,
}: {
    module: Module;
    uncovered: string[];
}) {
    const create = useCreateSession(module.id);
    const navigate = useNavigate();
    const formId = `new-session-${module.id}`;
    const pickError = fieldErrorText(create.error, 'competencyIds');
    return (
        <details className="space-y-3 pt-1">
            <summary className="focus-visible:outline-ring w-fit cursor-pointer list-none rounded-xl focus-visible:outline-3 focus-visible:outline-offset-3 [&::-webkit-details-marker]:hidden">
                <span
                    className={buttonVariants({
                        variant:
                            module.sessions.length > 0 ? 'outline' : 'primary',
                    })}
                >
                    {module.sessions.length > 0
                        ? 'Susun sesi baru'
                        : 'Susun sesi'}
                </span>
            </summary>
            <form
                className="space-y-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    create.mutate(
                        new FormData(event.currentTarget)
                            .getAll('competencyIds')
                            .map(Number),
                        {
                            onSuccess: ({ id }) =>
                                void navigate(`/teacher/studio/${id}`),
                        },
                    );
                }}
            >
                <fieldset
                    className="space-y-2"
                    aria-describedby={
                        pickError
                            ? `${formId}-hint ${formId}-error`
                            : `${formId}-hint`
                    }
                >
                    <legend className="mb-2 font-medium">
                        Kompetensi yang diajarkan sesi ini
                    </legend>
                    <p
                        id={`${formId}-hint`}
                        className="text-muted-foreground text-sm"
                    >
                        Kompetensi yang belum masuk sesi mana pun sudah
                        dicentang. Siswa mengerjakan sesi di bab ini sesuai
                        urutan dibuat.
                    </p>
                    {module.competencies.map((competency) => (
                        <label key={competency.id} className={choiceCard}>
                            <input
                                type="checkbox"
                                name="competencyIds"
                                value={competency.id}
                                defaultChecked={uncovered.includes(
                                    competency.code,
                                )}
                                className={choiceBox}
                            />
                            <span>
                                <span className="font-semibold">
                                    {competency.code}
                                </span>{' '}
                                {competency.description}
                            </span>
                        </label>
                    ))}
                </fieldset>
                {pickError ? (
                    <p
                        id={`${formId}-error`}
                        role="alert"
                        className="text-destructive"
                    >
                        {pickError}
                    </p>
                ) : (
                    <StudioError
                        error={create.error}
                        inline={['competencyIds']}
                    />
                )}
                <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? 'Menyiapkan sesi…' : 'Mulai susun'}
                </Button>
            </form>
        </details>
    );
}

function ModuleItem({ module, own }: { module: Module; own: boolean }) {
    const covered = new Set(
        module.sessions.flatMap(({ competencies }) => competencies),
    );
    const uncovered = module.competencies
        .map(({ code }) => code)
        .filter((code) => !covered.has(code));
    return (
        <li className="space-y-2 py-3">
            <div>
                <p className="font-semibold">{module.title}</p>
                {module.firstPage !== null && (
                    <p className="text-muted-foreground text-sm tabular-nums">
                        Halaman {module.firstPage} sampai {module.lastPage}
                    </p>
                )}
            </div>
            {module.competencies.length > 0 && (
                <ul className="space-y-1 text-sm">
                    {module.competencies.map((competency) => (
                        <li key={competency.id}>
                            <span className="font-semibold">
                                {competency.code}
                            </span>{' '}
                            {competency.description}
                            {competency.pages.length > 0 && (
                                <span className="text-muted-foreground tabular-nums">
                                    {' '}
                                    · Hal. {competency.pages.join(', ')}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {module.sessions.length > 0 && (
                <ul>
                    {module.sessions.map((session) => (
                        <li key={session.id}>
                            <Link
                                to={`/teacher/studio/${session.id}`}
                                className={textLink}
                            >
                                {session.title}
                            </Link>{' '}
                            <span className="text-muted-foreground text-sm">
                                ·{' '}
                                {[
                                    ...(session.competencies.length > 0
                                        ? [listOf(session.competencies)]
                                        : []),
                                    sessionState(session),
                                ].join(' · ')}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {own && module.sessions.length > 0 && uncovered.length > 0 && (
                <p className="text-muted-foreground text-sm">
                    Belum masuk sesi mana pun: {listOf(uncovered)}
                </p>
            )}
            {own && <NewSession module={module} uncovered={uncovered} />}
        </li>
    );
}

function listOf(items: (number | string)[]) {
    if (items.length === 1) return String(items[0]);
    return `${items.slice(0, -1).join(', ')} dan ${items.at(-1)}`;
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
                                <ModuleItem
                                    key={module.id}
                                    module={module}
                                    own={!material.prepared}
                                />
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
