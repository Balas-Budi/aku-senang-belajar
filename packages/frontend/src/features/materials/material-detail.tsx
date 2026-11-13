import {
    SectionTabs,
    useSection,
    type SectionTab,
} from '../../components/section-tabs';
import { Pager, usePages } from '../../components/pager';
import {
    BookIcon,
    SendIcon,
    SettingsIcon,
} from '../../components/icons/workspace-icons';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router';
import { materialMeta } from './library';
import { BookViewer } from './book-viewer';
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

function pageRanges(pages: number[]) {
    const sorted = [...new Set(pages)].sort((a, b) => a - b);
    const parts: string[] = [];
    for (let i = 0; i < sorted.length; i++) {
        const start = sorted[i];
        while (sorted[i + 1] === sorted[i] + 1) i++;
        parts.push(start === sorted[i] ? `${start}` : `${start}–${sorted[i]}`);
    }
    return parts.join(', ');
}

function chapterStatus(module: Module) {
    const total = module.sessions.length;
    const ready = module.sessions.filter(
        (session) => session.status === 'ready',
    ).length;
    if (total === 0)
        return {
            text: 'Belum ada misi',
            tone: 'bg-muted text-muted-foreground',
        };
    if (ready === total)
        return {
            text: `${ready} misi siap`,
            tone: 'bg-status-visible/10 text-status-visible',
        };
    return {
        text: `${total - ready} misi masih draf`,
        tone: 'bg-status-developing-soft text-status-developing',
    };
}

function Subheading({ children }: { children: string }) {
    return (
        <h4 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
            {children}
        </h4>
    );
}

function ModuleItem({
    number,
    module,
    material,
    open,
    onToggle,
    onChange,
}: {
    number: number;
    module: Module;
    material: MaterialDetail;
    open: boolean;
    onToggle: () => void;
    onChange: (text: string, removed?: boolean) => void;
}) {
    const own = !material.prepared;
    const covered = new Set(
        module.sessions.flatMap(({ competencies }) => competencies),
    );
    const uncovered = module.competencies
        .map(({ code }) => code)
        .filter((code) => !covered.has(code));
    const summary = [
        ...(module.firstPage !== null
            ? [`Hal. ${module.firstPage}–${module.lastPage}`]
            : []),
        `${module.competencies.length} kompetensi`,
        ...(module.sessions.length > 0
            ? [`${module.sessions.length} misi`]
            : []),
    ];
    const origin = [
        ...(module.madeBy === 'ai'
            ? ['Disusun AI dari buku']
            : ['Bab buatan Anda']),
        ...(module.version !== material.version
            ? [`Dari versi ${module.version}`]
            : []),
    ];
    const status = chapterStatus(module);
    const bodyId = `chapter-${module.id}`;
    return (
        <li className="border-paper-edge overflow-hidden rounded-2xl border bg-white">
            <h3>
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={onToggle}
                    className="hover:bg-student-surface focus-visible:outline-ring flex w-full items-center gap-3 p-4 text-left focus-visible:outline-3 focus-visible:-outline-offset-3 sm:gap-4"
                >
                    <span
                        aria-hidden="true"
                        className="bg-secondary text-primary-deep font-display flex size-8 shrink-0 items-center justify-center rounded-lg text-base font-semibold sm:size-10 sm:rounded-xl sm:text-lg"
                    >
                        {number}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="font-display text-primary-deep block text-lg leading-tight font-semibold break-words sm:text-xl">
                            {module.title}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-muted-foreground text-sm tabular-nums">
                                {summary.join(' · ')}
                            </span>
                            <span
                                className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${status.tone}`}
                            >
                                {status.text}
                            </span>
                        </span>
                    </span>
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`text-primary size-6 shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                </button>
            </h3>
            <div
                id={bodyId}
                hidden={!open}
                className="border-paper-edge space-y-5 border-t p-4 sm:p-5"
            >
                <p className="text-muted-foreground text-sm">
                    {origin.join(' · ')}
                </p>
                {module.competencies.length > 0 && (
                    <div className="space-y-2">
                        <Subheading>Yang dipelajari</Subheading>
                        <ul className="space-y-2">
                            {module.competencies.map((competency) => (
                                <li
                                    key={competency.id}
                                    className="flex items-start gap-3"
                                >
                                    <span
                                        className={`mt-0.5 w-10 shrink-0 rounded-lg py-0.5 text-center text-sm font-bold ${
                                            covered.has(competency.code)
                                                ? 'bg-primary text-white'
                                                : 'bg-secondary text-primary-deep'
                                        }`}
                                    >
                                        {competency.code}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block leading-relaxed">
                                            {competency.description}
                                        </span>
                                        {competency.pages.length > 0 && (
                                            <span className="text-muted-foreground block text-sm tabular-nums">
                                                Halaman{' '}
                                                {pageRanges(competency.pages)}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {module.sessions.length > 0 && (
                    <div className="space-y-2">
                        <Subheading>Misi</Subheading>
                        <ul className="space-y-2">
                            {module.sessions.map((session) => (
                                <li
                                    key={session.id}
                                    className="bg-student-surface flex flex-wrap items-center gap-3 rounded-xl p-3"
                                >
                                    <span className="min-w-0 flex-1 basis-48">
                                        <span className="block font-semibold break-words">
                                            {session.title}
                                        </span>
                                        <span className="text-muted-foreground block text-sm">
                                            {[
                                                ...(session.competencies
                                                    .length > 0
                                                    ? [
                                                          listOf(
                                                              session.competencies,
                                                          ),
                                                      ]
                                                    : []),
                                                sessionState(session),
                                            ].join(' · ')}
                                        </span>
                                    </span>
                                    <Link
                                        to={`/teacher/studio/${session.id}`}
                                        aria-label={`Buka studio ${session.title}`}
                                        className={buttonVariants({
                                            variant: 'outline',
                                            className: 'min-h-11 bg-white px-4',
                                        })}
                                    >
                                        Buka studio
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {own && module.sessions.length > 0 && uncovered.length > 0 && (
                    <p className="bg-status-developing-soft text-status-developing rounded-xl px-3 py-2 text-sm font-semibold">
                        Belum masuk misi mana pun: {listOf(uncovered)}
                    </p>
                )}
                {own && !material.archived && (
                    <div className="border-paper-edge space-y-3 border-t pt-4">
                        <NewSession module={module} uncovered={uncovered} />
                        <ChapterActions
                            materialId={material.id}
                            module={module}
                            onDone={onChange}
                        />
                    </div>
                )}
            </div>
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

function PageList({ material }: { material: MaterialDetail }) {
    const { page, pages, setPage, shown } = usePages(material.pages, 20);
    return (
        <div className="space-y-4">
            <ul className="divide-paper-edge divide-y">
                {shown.map((item) => (
                    <PageRow
                        key={item.number}
                        materialId={material.id}
                        version={material.version}
                        page={item}
                    />
                ))}
            </ul>
            <Pager
                label="Halaman daftar halaman buku"
                page={page}
                pages={pages}
                onPage={setPage}
            />
        </div>
    );
}

export function MaterialDetailView({ id }: { id: number }) {
    const query = useQuery(materialQuery(id));
    const reactivate = useUpdateMaterial(id);
    const [asking, setAsking] = useState(false);
    const [openChapters, setOpenChapters] = useState<Set<number>>(
        () => new Set(),
    );
    const [message, setMessage] = useState({ text: '', count: 0 });
    const heading = useRef<HTMLHeadingElement>(null);
    const chaptersHeading = useRef<HTMLHeadingElement>(null);
    const say = (text: string) =>
        setMessage((previous) => ({ text, count: previous.count + 1 }));
    const tabs: SectionTab[] = [
        {
            key: 'bab',
            label: 'Bab dan misi',
            icon: <SendIcon className="size-5" />,
            badge: query.data ? String(query.data.modules.length) : null,
        },
        {
            key: 'halaman',
            label: 'Buku',
            icon: <BookIcon className="size-5" />,
            badge: query.data ? String(query.data.pageCount) : null,
        },
        {
            key: 'sumber',
            label: 'Sumber dan versi',
            icon: <SettingsIcon className="size-5" />,
        },
    ];
    const section = useSection(tabs);
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
    const hasFile =
        material.versions.find(({ version }) => version === material.version)
            ?.hasFile ?? false;
    const chapters = [...material.modules].sort(
        (a, b) =>
            (a.firstPage ?? Number.MAX_SAFE_INTEGER) -
            (b.firstPage ?? Number.MAX_SAFE_INTEGER),
    );
    const allOpen =
        chapters.length > 0 && chapters.every(({ id }) => openChapters.has(id));
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
            <Card className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <span
                    aria-hidden="true"
                    className="bg-secondary text-primary-deep hidden size-16 shrink-0 items-center justify-center rounded-2xl sm:flex"
                >
                    <BookIcon className="size-8" />
                </span>
                <div className="min-w-0 flex-1 basis-64">
                    <h1
                        ref={heading}
                        tabIndex={-1}
                        className={`font-display text-primary-deep text-3xl leading-tight font-semibold break-words sm:text-4xl ${focusHeading}`}
                    >
                        {material.title}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-lg tabular-nums">
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
                    <Button
                        variant="outline"
                        className="min-h-11 bg-white px-4"
                        onClick={() => setAsking(true)}
                    >
                        Arsipkan materi
                    </Button>
                )}
            </Card>
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
            <SectionTabs
                label={`Bagian materi ${material.title}`}
                tabs={tabs}
                current={section}
            />
            {section === 'bab' && material.modules.length === 0 && (
                <Card>
                    <p>
                        {reading
                            ? 'Bab muncul di sini setelah AI selesai membaca buku.'
                            : 'Belum ada bab. Tambahkan bab sendiri di bawah.'}
                    </p>
                </Card>
            )}
            {section === 'bab' && material.modules.length > 0 && (
                <Card>
                    <section
                        aria-labelledby="modules-title"
                        className="space-y-3"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2
                                ref={chaptersHeading}
                                id="modules-title"
                                tabIndex={-1}
                                className={`font-display text-primary-deep text-xl font-semibold sm:text-2xl ${focusHeading}`}
                            >
                                Bab
                            </h2>
                            {chapters.length > 1 && (
                                <Button
                                    variant="outline"
                                    className="min-h-11 px-4"
                                    onClick={() =>
                                        setOpenChapters(
                                            allOpen
                                                ? new Set()
                                                : new Set(
                                                      chapters.map(
                                                          ({ id }) => id,
                                                      ),
                                                  ),
                                        )
                                    }
                                >
                                    {allOpen ? 'Tutup semua' : 'Buka semua'}
                                </Button>
                            )}
                        </div>
                        {own && (
                            <p className="text-muted-foreground">
                                Pilih bab yang akan diajarkan, lalu susun
                                misinya. Bab yang tidak dipakai boleh dibiarkan.
                            </p>
                        )}
                        <ul className="space-y-3">
                            {chapters.map((module, index) => (
                                <ModuleItem
                                    key={module.id}
                                    number={index + 1}
                                    module={module}
                                    material={material}
                                    open={openChapters.has(module.id)}
                                    onToggle={() =>
                                        setOpenChapters((current) => {
                                            const next = new Set(current);
                                            if (!next.delete(module.id))
                                                next.add(module.id);
                                            return next;
                                        })
                                    }
                                    onChange={changed}
                                />
                            ))}
                        </ul>
                    </section>
                </Card>
            )}
            {section === 'bab' &&
                own &&
                !material.archived &&
                material.readablePages > 0 && (
                    <details className="space-y-3">
                        <summary className="focus-visible:outline-ring w-fit cursor-pointer list-none rounded-xl focus-visible:outline-3 focus-visible:outline-offset-3 [&::-webkit-details-marker]:hidden">
                            <span
                                className={buttonVariants({
                                    variant: 'outline',
                                })}
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
            {section === 'sumber' && <LicenceCard material={material} />}
            {section === 'sumber' && own && <VersionCard material={material} />}
            {section === 'halaman' && hasFile && (
                <Card>
                    <section aria-labelledby="book-title" className="space-y-4">
                        <h2
                            id="book-title"
                            className="font-display text-primary-deep text-xl font-semibold sm:text-2xl"
                        >
                            Buku
                        </h2>
                        <BookViewer
                            key={material.version}
                            url={`/api/materials/${material.id}/file?version=${material.version}`}
                            pageCount={material.pageCount}
                            chapters={material.modules.filter(
                                ({ version }) => version === material.version,
                            )}
                        />
                    </section>
                </Card>
            )}
            {section === 'halaman' && !hasFile && material.pages.length > 0 && (
                <Card>
                    <section
                        aria-labelledby="pages-title"
                        className="space-y-2"
                    >
                        <h2
                            id="pages-title"
                            className="font-display text-primary-deep text-xl font-semibold sm:text-2xl"
                        >
                            Halaman{' '}
                            <span className="text-muted-foreground ml-1 text-sm font-normal tabular-nums">
                                {material.pageCount}
                            </span>
                        </h2>
                        <p className="text-muted-foreground">
                            PDF asli materi ini tidak tersedia, jadi yang tampil
                            teks tiap halaman.
                        </p>
                        <PageList key={material.version} material={material} />
                    </section>
                </Card>
            )}
        </div>
    );
}
