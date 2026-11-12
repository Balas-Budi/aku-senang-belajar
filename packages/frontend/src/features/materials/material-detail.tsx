import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router';
import { materialMeta } from './library';
import { ChapterActions } from './chapter-actions';
import { LicenceCard } from './licence-card';
import { MaterialChangeDialog } from './material-change-dialog';
import { ModuleForm } from './module-form';
import {
    materialQuery,
    pageTextQuery,
    pagesRead,
    readingActive,
    useReadAgain,
    useUpdateMaterial,
    type MaterialDetail,
} from './queries';
import { VersionCard } from './version-card';
import { fieldErrorText } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button, buttonVariants } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { textLink } from '../../components/ui/text-link';
import { useCreateSession, type SessionLength } from '../studio/queries';
import {
    choiceBox,
    choiceCard,
    focusHeading,
    lengthLabels,
} from '../studio/studio-labels';
import { StudioError } from '../studio/studio-error';

type Module = MaterialDetail['modules'][number];

const lengths = ['short', 'medium', 'long'] as const;

const lengthHints: Record<SessionLength, string> = {
    short: '4 sampai 5 layar cerita',
    medium: '6 sampai 7 layar cerita',
    long: '8 sampai 10 layar cerita',
};

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
                    const form = new FormData(event.currentTarget);
                    create.mutate(
                        {
                            competencyIds: form
                                .getAll('competencyIds')
                                .map(Number),
                            length:
                                lengths.find(
                                    (length) => length === form.get('length'),
                                ) ?? 'medium',
                        },
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
                {pickError && (
                    <p
                        id={`${formId}-error`}
                        role="alert"
                        className="text-destructive"
                    >
                        {pickError}
                    </p>
                )}
                <fieldset className="space-y-2">
                    <legend className="mb-2 font-medium">Panjang misi</legend>
                    {lengths.map((length) => (
                        <label key={length} className={choiceCard}>
                            <input
                                type="radio"
                                name="length"
                                value={length}
                                defaultChecked={length === 'medium'}
                                className={choiceBox}
                            />
                            <span>
                                <span className="block font-semibold">
                                    {lengthLabels[length]}
                                </span>
                                <span className="text-muted-foreground block text-sm">
                                    {lengthHints[length]}
                                </span>
                            </span>
                        </label>
                    ))}
                </fieldset>
                {!pickError && (
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

function ModuleItem({
    module,
    material,
    onChange,
}: {
    module: Module;
    material: MaterialDetail;
    onChange: (text: string, removed?: boolean) => void;
}) {
    const own = !material.prepared;
    const covered = new Set(
        module.sessions.flatMap(({ competencies }) => competencies),
    );
    const uncovered = module.competencies
        .map(({ code }) => code)
        .filter((code) => !covered.has(code));
    const origin = [
        ...(module.madeBy === 'ai' ? ['Disusun AI dari buku'] : []),
        ...(module.firstPage !== null
            ? [`Halaman ${module.firstPage} sampai ${module.lastPage}`]
            : []),
        ...(module.version !== material.version
            ? [`Dari versi ${module.version}`]
            : []),
    ];
    return (
        <li className="space-y-2 py-3">
            <div>
                <p className="font-semibold">{module.title}</p>
                {origin.length > 0 && (
                    <p className="text-muted-foreground text-sm tabular-nums">
                        {origin.join(' · ')}
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
            {own && !material.archived && (
                <ChapterActions
                    materialId={material.id}
                    module={module}
                    onDone={onChange}
                />
            )}
            {own && !material.archived && (
                <NewSession module={module} uncovered={uncovered} />
            )}
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
    version,
}: {
    materialId: number;
    number: number;
    version: number;
}) {
    const page = useQuery(pageTextQuery(materialId, number, version));
    if (page.isPending) return <p role="status">Memuat teks halaman…</p>;
    if (page.isError) return <RequestError error={page.error} />;
    return (
        <div className="space-y-3">
            {page.data.text && (
                <p className="whitespace-pre-line">{page.data.text}</p>
            )}
            {page.data.visual && (
                <div className="bg-muted rounded-lg px-3 py-2">
                    <p className="text-sm font-semibold">Isi gambar</p>
                    <p className="mt-1 whitespace-pre-line">
                        {page.data.visual}
                    </p>
                </div>
            )}
        </div>
    );
}

function ReadingNotice({
    material,
    focusAfter,
}: {
    material: MaterialDetail;
    focusAfter: RefObject<HTMLHeadingElement | null>;
}) {
    const again = useReadAgain(material.id);
    const { reading } = material;
    if (reading.state === 'failed')
        return (
            <Alert tone="attention" className="space-y-3">
                <p className="font-semibold">
                    AI belum selesai membaca buku ini
                </p>
                <p>
                    Bab yang sudah tersusun tetap ada. Coba baca ulang, atau
                    tambahkan bab sendiri dari halaman buku.
                </p>
                <RequestError error={again.error} />
                <Button
                    variant="outline"
                    aria-disabled={again.isPending}
                    className="aria-disabled:opacity-60"
                    onClick={() => {
                        if (again.isPending) return;
                        again.mutate(undefined, {
                            onSuccess: () => focusAfter.current?.focus(),
                        });
                    }}
                >
                    {again.isPending ? 'Memulai…' : 'Baca ulang'}
                </Button>
            </Alert>
        );
    if (!readingActive(reading)) return null;
    const total = reading.pictured + reading.described;
    return (
        <Alert role="status">
            <p className="font-semibold">AI sedang membaca buku ini</p>
            <p className="mt-1 tabular-nums">
                {reading.state === 'opening'
                    ? 'Membuka buku dan mengambil teks tiap halaman. Buku tebal bisa perlu beberapa menit.'
                    : reading.state === 'reading_pages'
                      ? total > 0
                          ? `Membaca gambar: ${reading.described} dari ${total} halaman bergambar.`
                          : 'Membaca halaman buku.'
                      : reading.chapters === null
                        ? 'Menyusun daftar bab dari isi buku.'
                        : `Menyusun kompetensi: ${material.modules.filter(({ madeBy, version }) => madeBy === 'ai' && version === material.version).length} dari ${reading.chapters} bab.`}{' '}
                Halaman ini diperbarui sendiri. Anda boleh meninggalkannya.
            </p>
        </Alert>
    );
}

function PageRow({
    materialId,
    version,
    page,
}: {
    materialId: number;
    version: number;
    page: MaterialDetail['pages'][number];
}) {
    const [open, setOpen] = useState(false);
    if (!page.readable)
        return (
            <li className="py-3">
                <p className="font-semibold">Halaman {page.number}</p>
                <p className="text-muted-foreground text-sm">
                    Tidak ada teks atau gambar yang terbaca
                </p>
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
                            version={version}
                        />
                    )}
                </div>
            </details>
        </li>
    );
}

export function MaterialDetailView({ id }: { id: number }) {
    const query = useQuery(materialQuery(id));
    const reactivate = useUpdateMaterial(id);
    const [asking, setAsking] = useState(false);
    const [message, setMessage] = useState({ text: '', count: 0 });
    const heading = useRef<HTMLHeadingElement>(null);
    const chaptersHeading = useRef<HTMLHeadingElement>(null);
    const say = (text: string) =>
        setMessage((previous) => ({ text, count: previous.count + 1 }));
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
    const own = !material.prepared;
    const reading = readingActive(material.reading);
    const unreadable = reading
        ? []
        : material.pages
              .filter((page) => !page.readable)
              .map((page) => page.number);
    const changed = (text: string, removed?: boolean) => {
        say(text);
        if (removed)
            requestAnimationFrame(() => chaptersHeading.current?.focus());
    };
    return (
        <div className="space-y-6">
            {own && (
                <MaterialChangeDialog
                    materialId={material.id}
                    title="Arsipkan materi ini?"
                    note="Materi yang diarsipkan tidak bisa dipakai untuk bab atau misi baru. Bab dan misi yang sudah ada tetap berjalan."
                    confirm="Arsipkan materi"
                    pending="Mengarsipkan…"
                    change={{ archived: true }}
                    open={asking}
                    focusAfter={heading}
                    onClose={() => setAsking(false)}
                    onChanged={() => {
                        setAsking(false);
                        say('Materi diarsipkan.');
                    }}
                />
            )}
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1 basis-64">
                    <h1
                        ref={heading}
                        tabIndex={-1}
                        className={`text-2xl font-semibold break-words ${focusHeading}`}
                    >
                        {material.title}
                    </h1>
                    <p className="text-muted-foreground mt-2 tabular-nums">
                        {materialMeta(material)} ·{' '}
                        {own
                            ? pagesRead(material)
                            : 'Disiapkan tim Aku Senang Belajar'}
                    </p>
                    <p
                        role="status"
                        className="text-primary-deep mt-2 font-medium empty:mt-0"
                    >
                        {message.text !== '' && (
                            <span key={message.count}>{message.text}</span>
                        )}
                    </p>
                </div>
                {own && !material.archived && (
                    <Button variant="outline" onClick={() => setAsking(true)}>
                        Arsipkan materi
                    </Button>
                )}
            </div>
            {material.archived && (
                <Alert className="space-y-3">
                    <p>
                        Materi ini diarsipkan. Bab dan misi yang sudah ada tetap
                        berjalan.
                    </p>
                    {own && (
                        <>
                            <RequestError error={reactivate.error} />
                            <Button
                                variant="outline"
                                aria-disabled={reactivate.isPending}
                                className="aria-disabled:opacity-60"
                                onClick={() => {
                                    if (reactivate.isPending) return;
                                    reactivate.mutate(
                                        { archived: false },
                                        {
                                            onSuccess: () => {
                                                say('Materi aktif lagi.');
                                                heading.current?.focus();
                                            },
                                        },
                                    );
                                }}
                            >
                                {reactivate.isPending
                                    ? 'Mengaktifkan…'
                                    : 'Aktifkan lagi'}
                            </Button>
                        </>
                    )}
                </Alert>
            )}
            {own && <ReadingNotice material={material} focusAfter={heading} />}
            {unreadable.length > 0 && (
                <Alert tone="attention">
                    <p className="font-semibold">
                        {unreadable.length} halaman tidak terbaca
                    </p>
                    <p className="mt-1">
                        Halaman {listOf(unreadable)} tidak punya teks atau
                        gambar yang bisa dibaca AI, jadi tidak dipakai untuk
                        menyusun bab dan sesi. Bila isinya penting, unggah versi
                        PDF yang lebih jelas.
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
                            ref={chaptersHeading}
                            id="modules-title"
                            tabIndex={-1}
                            className={`text-lg font-semibold ${focusHeading}`}
                        >
                            Bab
                        </h2>
                        {own && (
                            <p className="text-muted-foreground">
                                Pilih bab yang akan diajarkan, lalu susun
                                sesinya. Bab yang tidak dipakai boleh dibiarkan.
                            </p>
                        )}
                        <ul className="divide-paper-edge divide-y">
                            {material.modules.map((module) => (
                                <ModuleItem
                                    key={module.id}
                                    module={module}
                                    material={material}
                                    onChange={changed}
                                />
                            ))}
                        </ul>
                    </section>
                </Card>
            )}
            {own && !material.archived && material.readablePages > 0 && (
                <details className="space-y-3">
                    <summary className="focus-visible:outline-ring w-fit cursor-pointer list-none rounded-xl focus-visible:outline-3 focus-visible:outline-offset-3 [&::-webkit-details-marker]:hidden">
                        <span
                            className={buttonVariants({ variant: 'outline' })}
                        >
                            Tambah bab sendiri
                        </span>
                    </summary>
                    <ModuleForm
                        key={material.version}
                        materialId={material.id}
                        pageCount={material.pageCount}
                    />
                </details>
            )}
            <LicenceCard material={material} />
            {own && <VersionCard material={material} />}
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
                        <ul
                            key={material.version}
                            className="divide-paper-edge divide-y"
                        >
                            {material.pages.map((page) => (
                                <PageRow
                                    key={page.number}
                                    materialId={material.id}
                                    version={material.version}
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
