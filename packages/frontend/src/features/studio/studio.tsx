import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AddStoryForm } from './add-story-form';
import { BlockEditor } from './block-editor';
import type { DiagramField } from './block-fields';
import { BlockView } from './block-view';
import {
    studioSessionQuery,
    useApproveSession,
    useAssignSession,
    useEditBlock,
    useMoveBlock,
    useReviseSession,
    useSetReadAloud,
    type Issue,
    type StudioBlock,
    type StudioSession,
    type Warning,
} from './queries';
import { RemoveDiagramDialog } from './remove-diagram-dialog';
import { RemoveScreenDialog } from './remove-screen-dialog';
import { StudioError } from './studio-error';
import {
    choiceBox,
    choiceCard,
    failures,
    joined,
    kindLabels,
    lengthLabels,
    stepOfKind,
    themeLabels,
} from './studio-labels';
import { ThemesCard } from './themes';
import { TextAreaField, fieldErrorText } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { textLink } from '../../components/ui/text-link';
import { classesQuery } from '../classes/queries';
import { stepLabels, stepOrder } from '../learning-sessions/steps';

function stateOf(session: StudioSession) {
    if (session.prepared) return 'Disiapkan tim Aku Senang Belajar';
    if (session.status === 'ready') return 'Siap ditugaskan';
    if (session.version === 0) return 'Belum ada draf';
    return `Draf versi ${session.version}`;
}

function announcementOf(session: StudioSession) {
    if (session.prepared) return '';
    if (session.status === 'ready')
        return 'Sesi sudah terbit dan siap ditugaskan.';
    if (session.drafting === 'generating') return 'AI sedang menyusun sesi.';
    if (session.drafting === 'failed') return 'Penyusunan sesi belum berhasil.';
    if (session.version === 0) return '';
    return `Draf versi ${session.version} siap ditinjau.`;
}

function issueText({
    code,
    competencies = [],
    blocks = [],
    themes = [],
}: Issue) {
    switch (code) {
        case 'no_draft':
            return 'Sesi ini belum punya draf.';
        case 'missing_rubric':
            return `Kompetensi ${joined(competencies)} belum punya rubrik.`;
        case 'untested_competency':
            return `Kompetensi ${joined(competencies)} belum diuji oleh soal cek atau tantangan.`;
        case 'invalid_block':
            return `Layar ${joined(blocks)} belum memenuhi aturan layar siswa.`;
        case 'theme_drafting':
            return `Tema ${themeLabels(themes)} masih ditulis AI.`;
        case 'theme_failed':
            return `Tema ${themeLabels(themes)} belum berhasil ditulis. Tulis ulang atau hapus temanya.`;
        case 'theme_mismatch':
            return `Tema ${themeLabels(themes)} tidak lagi cocok dengan misi dasar. Tulis ulang temanya.`;
        case 'theme_unread':
            return `Tema ${themeLabels(themes)} belum dibaca.`;
        default:
            return code satisfies never;
    }
}

function warningText({ code, blocks = [], pages = [] }: Warning) {
    switch (code) {
        case 'no_page_source':
            return `Layar ${joined(blocks)} tidak punya halaman sumber, jadi isinya belum tentu berasal dari materi Anda.`;
        case 'unreadable_pages':
            return `Halaman ${joined(pages)} tidak terbaca, jadi isinya tidak dipakai dalam sesi ini.`;
        case 'ai_diagrams':
            return `Layar ${joined(blocks)} punya gambar buatan AI. Saya sudah memeriksa setiap gambar: jumlah, ukuran, dan warnanya sesuai dengan teks, misalnya bagian pecahan sama besar.`;
        case 'repeats_example':
            return `Layar ${joined(blocks)} memakai angka dan pilihan yang sama dengan sebuah soal cek, jadi belum menguji penerapan di situasi baru.`;
        default:
            return code satisfies never;
    }
}

function metaOf(block: StudioBlock) {
    if (block.kind === 'brain_game') return 'Tidak dinilai';
    return [
        block.competencies.join(', '),
        block.sourcePages.length > 0
            ? `Hal. ${block.sourcePages.join(', ')}`
            : 'Tanpa halaman sumber',
    ]
        .filter(Boolean)
        .join(' · ');
}

function DraftAlert({ session }: { session: StudioSession }) {
    const retry = useReviseSession(session.id);
    const hasDraft = session.blocks.length > 0;
    if (session.drafting === 'generating')
        return (
            <Alert>
                <p className="font-semibold">
                    {hasDraft
                        ? 'AI sedang merevisi sesi…'
                        : 'AI sedang menyusun sesi…'}
                </p>
                <p className="mt-1">
                    {hasDraft
                        ? 'Draf di bawah masih versi sebelumnya. Halaman ini berganti sendiri saat revisinya siap.'
                        : 'AI membaca halaman modul lalu menulis setiap layar. Halaman ini berganti sendiri saat drafnya siap.'}
                </p>
            </Alert>
        );
    if (session.drafting !== 'failed') return null;
    return (
        <Alert tone="attention" className="space-y-3">
            <div>
                <p className="font-semibold">
                    {hasDraft
                        ? 'Revisi terakhir belum berhasil'
                        : 'Sesi belum berhasil disusun'}
                </p>
                <p className="mt-1">
                    {failures[session.draftError ?? ''] ??
                        'Terjadi gangguan di server.'}{' '}
                    {hasDraft
                        ? 'Draf di bawah tidak berubah. Kirim permintaan revisi lagi bila perlu.'
                        : 'Coba susun ulang.'}
                </p>
            </div>
            {!hasDraft && (
                <>
                    <Button
                        disabled={retry.isPending}
                        onClick={() => retry.mutate('')}
                    >
                        {retry.isPending ? 'Mengirim…' : 'Susun ulang'}
                    </Button>
                    <StudioError error={retry.error} />
                </>
            )}
        </Alert>
    );
}

type Report = (text: string, focus: string[], version: number) => void;

const compact = 'min-h-11 px-3 aria-disabled:opacity-60';

const inMiddle = (block?: StudioBlock) =>
    block?.kind === 'story' || block?.kind === 'check';

function ScreenItem({
    session,
    block,
    editable,
    onAskRemove,
    onReport,
}: {
    session: StudioSession;
    block: StudioBlock;
    editable: boolean;
    onAskRemove: (block: StudioBlock) => void;
    onReport: Report;
}) {
    const edit = useEditBlock(session.id);
    const move = useMoveBlock(session.id);
    const [editing, setEditing] = useState(false);
    const [adding, setAdding] = useState(false);
    const [removing, setRemoving] = useState<DiagramField | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [notice, setNotice] = useState<{ text: string } | null>(null);
    const toggle = useRef<HTMLButtonElement>(null);
    const addToggle = useRef<HTMLButtonElement>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (notice) heading.current?.focus();
    }, [notice]);
    const index = session.blocks.indexOf(block);
    const movable = editable && inMiddle(block);
    const up = movable && inMiddle(session.blocks[index - 1]);
    const down = movable && inMiddle(session.blocks[index + 1]);
    const addable = editable && (block.kind === 'hook' || inMiddle(block));
    const close = () => {
        setEditing(false);
        toggle.current?.focus();
    };
    const shift = (direction: 'up' | 'down') => {
        if (move.isPending) return;
        const other = direction === 'up' ? 'down' : 'up';
        const to = block.position + (direction === 'up' ? -1 : 1);
        move.mutate(
            { blockId: block.id, move: direction },
            {
                onSuccess: (next) =>
                    onReport(
                        `${kindLabels[block.kind]} pindah ke layar ${to}.`,
                        [
                            `screen-${block.id}-${direction}`,
                            `screen-${block.id}-${other}`,
                        ],
                        next.version,
                    ),
            },
        );
    };
    return (
        <li className="space-y-3 py-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div>
                    <h3
                        ref={heading}
                        id={`screen-${block.id}`}
                        tabIndex={-1}
                        className="focus-visible:outline-ring rounded font-semibold focus-visible:outline-3 focus-visible:outline-offset-4"
                    >
                        Layar {block.position} · {kindLabels[block.kind]}
                    </h3>
                    <p className="text-muted-foreground text-sm tabular-nums">
                        {metaOf(block)}
                    </p>
                    <p role="status" className="mt-1 text-sm empty:mt-0">
                        {notice?.text}
                    </p>
                    {removing && block.kind !== 'brain_game' && (
                        <RemoveDiagramDialog
                            sessionId={session.id}
                            block={block}
                            field={removing}
                            open={confirming}
                            onClose={() => setConfirming(false)}
                            onDone={() => {
                                setConfirming(false);
                                setNotice({
                                    text: `${removing.name} dihapus. Minta revisi bila Anda perlu gambar lain.`,
                                });
                            }}
                        />
                    )}
                </div>
                {editable && block.kind !== 'brain_game' && (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            ref={toggle}
                            variant="outline"
                            className={compact}
                            aria-expanded={editing}
                            onClick={() => {
                                setNotice(null);
                                edit.reset();
                                setEditing(!editing);
                            }}
                        >
                            Ubah teks
                        </Button>
                        {up && (
                            <Button
                                id={`screen-${block.id}-up`}
                                variant="outline"
                                className={compact}
                                aria-disabled={move.isPending}
                                onClick={() => shift('up')}
                            >
                                Naik
                                <span className="sr-only">
                                    {' '}
                                    layar {block.position}
                                </span>
                            </Button>
                        )}
                        {down && (
                            <Button
                                id={`screen-${block.id}-down`}
                                variant="outline"
                                className={compact}
                                aria-disabled={move.isPending}
                                onClick={() => shift('down')}
                            >
                                Turun
                                <span className="sr-only">
                                    {' '}
                                    layar {block.position}
                                </span>
                            </Button>
                        )}
                        {movable && (
                            <Button
                                variant="outline"
                                className={compact}
                                onClick={() => onAskRemove(block)}
                            >
                                Hapus layar
                                <span className="sr-only">
                                    {' '}
                                    {block.position}
                                </span>
                            </Button>
                        )}
                    </div>
                )}
            </div>
            <StudioError error={move.error} />
            {editable && editing && block.kind !== 'brain_game' ? (
                <BlockEditor
                    block={block}
                    save={edit}
                    idPrefix={`block-${block.id}`}
                    onClose={close}
                />
            ) : (
                <BlockView
                    block={block}
                    onRemove={
                        editable && !editing
                            ? (field) => {
                                  setRemoving(field);
                                  setConfirming(true);
                              }
                            : undefined
                    }
                />
            )}
            {addable && (
                <div className="space-y-3">
                    <Button
                        ref={addToggle}
                        variant="outline"
                        className={compact}
                        aria-expanded={adding}
                        onClick={() => setAdding(!adding)}
                    >
                        Tambah layar cerita
                        <span className="sr-only">
                            {' '}
                            sesudah layar {block.position}
                        </span>
                    </Button>
                    {adding && (
                        <AddStoryForm
                            sessionId={session.id}
                            after={block}
                            onClose={() => {
                                setAdding(false);
                                addToggle.current?.focus();
                            }}
                            onAdded={(next) => {
                                setAdding(false);
                                const added = next.blocks.find(
                                    ({ position }) =>
                                        position === block.position + 1,
                                );
                                onReport(
                                    'Layar cerita ditambahkan.',
                                    added ? [`screen-${added.id}`] : [],
                                    next.version,
                                );
                            }}
                        />
                    )}
                </div>
            )}
        </li>
    );
}

const levels = [
    {
        label: 'Lebih mudah',
        note: 'Buat misi ini lebih mudah untuk siswa yang masih berkembang: kalimat lebih pendek dan sederhana, angka lebih kecil, contoh yang lebih dekat dengan kehidupan sehari-hari, dan petunjuk yang lebih membimbing. Pertahankan kompetensi, jumlah layar cerita, dan susunan misi.',
    },
    {
        label: 'Lebih menantang',
        note: 'Buat misi ini lebih menantang untuk siswa yang sudah menguasai dasarnya: angka lebih besar atau perbandingan yang lebih rumit, cek yang meminta alasan, dan petunjuk yang menyisakan langkah berpikir untuk siswa. Pertahankan kompetensi, jumlah layar cerita, dan susunan misi.',
    },
];

function RevisionForm({
    session,
    themeDrafting,
}: {
    session: StudioSession;
    themeDrafting: boolean;
}) {
    const revise = useReviseSession(session.id);
    const generating = session.drafting === 'generating' || themeDrafting;
    const fixedNote = levels.some(({ note }) => note === revise.variables);
    return (
        <Card>
            <section aria-labelledby="revision-title" className="space-y-4">
                <div>
                    <h2 id="revision-title" className="text-lg font-semibold">
                        Minta revisi
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        AI menulis ulang seluruh sesi dari draf ini. Teks dan
                        gambar yang ada ikut dikirim; AI mempertahankan gambar
                        yang tidak Anda sebut, tetapi bisa ikut mengubahnya.
                        Gambar yang Anda hapus tidak digambar lagi kecuali Anda
                        memintanya.
                    </p>
                    {session.themes.length > 0 && (
                        <p className="text-muted-foreground mt-1">
                            Revisi menghapus semua tema cerita; pilih lagi
                            setelah revisi selesai.
                        </p>
                    )}
                </div>
                {themeDrafting && (
                    <Alert>
                        Tunggu sampai AI selesai menulis tema sebelum meminta
                        revisi.
                    </Alert>
                )}
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const note = new FormData(event.currentTarget).get(
                            'note',
                        );
                        revise.mutate(String(note ?? '').trim());
                    }}
                >
                    <TextAreaField
                        name="note"
                        label="Yang perlu diubah"
                        hint="Contoh: pakai contoh kue, bukan roti, atau tambahkan gambar pada petunjuk 2 di layar 5. Kosongkan bila AI perlu menyusun ulang dari awal."
                        rows={3}
                        maxLength={500}
                        disabled={generating}
                        error={revise.error}
                    />
                    <StudioError error={revise.error} inline={['note']} />
                    <div className="flex flex-wrap gap-3">
                        <Button
                            type="submit"
                            disabled={generating || revise.isPending}
                        >
                            {revise.isPending && !fixedNote
                                ? 'Mengirim…'
                                : 'Minta revisi'}
                        </Button>
                        {levels.map(({ label, note }) => (
                            <Button
                                key={label}
                                variant="outline"
                                disabled={generating || revise.isPending}
                                onClick={() => revise.mutate(note)}
                            >
                                {revise.isPending && revise.variables === note
                                    ? 'Mengirim…'
                                    : label}
                            </Button>
                        ))}
                    </div>
                </form>
            </section>
        </Card>
    );
}

function PublishCard({
    session,
    onPublished,
}: {
    session: StudioSession;
    onPublished: () => void;
}) {
    const approve = useApproveSession(session.id);
    const blocked = session.issues.length > 0;
    return (
        <Card>
            <section aria-labelledby="publish-title" className="space-y-4">
                <div>
                    <h2 id="publish-title" className="text-lg font-semibold">
                        Terbitkan
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Sesi yang sudah terbit tidak bisa diubah lagi dan siap
                        ditugaskan ke kelas.
                    </p>
                </div>
                {blocked && (
                    <Alert tone="attention">
                        <p className="font-semibold">Belum bisa diterbitkan</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                            {session.issues.map((issue) => (
                                <li key={issue.code}>{issueText(issue)}</li>
                            ))}
                        </ul>
                    </Alert>
                )}
                <form
                    key={JSON.stringify([session.blocks, session.warnings])}
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const acknowledged = new FormData(event.currentTarget)
                            .getAll('acknowledged')
                            .map(String);
                        approve.mutate(
                            { acknowledged, version: session.version },
                            { onSuccess: onPublished },
                        );
                    }}
                >
                    {session.warnings.length > 0 && (
                        <fieldset className="space-y-2">
                            <legend className="mb-2 font-medium">
                                Centang setelah Anda memeriksanya
                            </legend>
                            {session.warnings.map((warning) => (
                                <label
                                    key={warning.code}
                                    className={choiceCard}
                                >
                                    <input
                                        type="checkbox"
                                        name="acknowledged"
                                        value={warning.code}
                                        required
                                        className={choiceBox}
                                    />
                                    <span>{warningText(warning)}</span>
                                </label>
                            ))}
                        </fieldset>
                    )}
                    <StudioError error={approve.error} />
                    <Button
                        type="submit"
                        disabled={blocked || approve.isPending}
                    >
                        {approve.isPending ? 'Menerbitkan…' : 'Terbitkan sesi'}
                    </Button>
                </form>
            </section>
        </Card>
    );
}

function AssignCard({
    session,
    takeFocus,
}: {
    session: StudioSession;
    takeFocus: boolean;
}) {
    const classes = useQuery(classesQuery());
    const assign = useAssignSession(session.id);
    const heading = useRef<HTMLHeadingElement>(null);
    const [message, setMessage] = useState('');
    useEffect(() => {
        if (takeFocus) heading.current?.focus();
    }, [takeFocus]);
    const assigned = new Set(session.assignedClasses.map(({ id }) => id));
    const open = (classes.data ?? []).filter(({ id }) => !assigned.has(id));
    const classError = fieldErrorText(assign.error, 'classIds');
    return (
        <Card>
            <section aria-labelledby="assign-title" className="space-y-4">
                <div>
                    <h2
                        id="assign-title"
                        ref={heading}
                        tabIndex={-1}
                        className="focus-visible:outline-ring rounded text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-4"
                    >
                        Tugaskan ke kelas
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Siswa di kelas yang dipilih langsung bisa memulai misi
                        ini dari beranda mereka.
                    </p>
                </div>
                {session.assignedClasses.length > 0 && (
                    <p>
                        Sudah ditugaskan ke{' '}
                        {joined(
                            session.assignedClasses.map(({ name }) => name),
                        )}
                        .
                    </p>
                )}
                {classes.isPending ? (
                    <p role="status">Memuat kelas…</p>
                ) : classes.isError ? (
                    <RequestError error={classes.error} />
                ) : classes.data.length === 0 ? (
                    <p>
                        Anda belum punya kelas.{' '}
                        <Link to="/teacher/classes" className={textLink}>
                            Buat kelas dulu
                        </Link>
                        , lalu kembali ke sini.
                    </p>
                ) : open.length === 0 ? (
                    <p className="text-muted-foreground">
                        Semua kelas Anda sudah mendapat misi ini.
                    </p>
                ) : (
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            const classIds = new FormData(event.currentTarget)
                                .getAll('classIds')
                                .map(Number);
                            const names = open
                                .filter(({ id }) => classIds.includes(id))
                                .map(({ name }) => name);
                            setMessage('');
                            assign.mutate(classIds, {
                                onSuccess: () =>
                                    setMessage(
                                        `Misi ditugaskan ke ${joined(names)}.`,
                                    ),
                            });
                        }}
                    >
                        <fieldset
                            className="space-y-2"
                            aria-describedby={
                                classError ? 'classIds-error' : undefined
                            }
                        >
                            <legend className="mb-2 font-medium">Kelas</legend>
                            {open.map((classroom) => (
                                <label
                                    key={classroom.id}
                                    className={choiceCard}
                                >
                                    <input
                                        type="checkbox"
                                        name="classIds"
                                        value={classroom.id}
                                        className={choiceBox}
                                    />
                                    <span>
                                        {classroom.name}{' '}
                                        <span className="text-muted-foreground text-sm tabular-nums">
                                            · {classroom.studentCount} siswa
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                        {classError ? (
                            <p
                                id="classIds-error"
                                role="alert"
                                className="text-destructive"
                            >
                                {classError}
                            </p>
                        ) : (
                            <StudioError error={assign.error} />
                        )}
                        <Button type="submit" disabled={assign.isPending}>
                            {assign.isPending ? 'Menugaskan…' : 'Tugaskan'}
                        </Button>
                    </form>
                )}
                <p role="status" className="sr-only">
                    {message}
                </p>
            </section>
        </Card>
    );
}

function ReadAloudCard({ session }: { session: StudioSession }) {
    const save = useSetReadAloud(session.id);
    const on =
        save.isPending && save.variables !== undefined
            ? save.variables
            : session.readAloud;
    return (
        <Card className="space-y-2">
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
                <span className="text-lg font-semibold">
                    Dibacakan otomatis
                </span>
                <input
                    type="checkbox"
                    role="switch"
                    checked={on}
                    aria-describedby="read-aloud-help"
                    onChange={(event) => save.mutate(event.target.checked)}
                    className="peer sr-only"
                />
                <span
                    aria-hidden="true"
                    className="bg-border peer-checked:bg-primary peer-focus-visible:outline-ring relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5 motion-reduce:transition-none motion-reduce:after:transition-none"
                />
            </label>
            <p
                id="read-aloud-help"
                className="text-muted-foreground max-w-prose"
            >
                Layar misi dibacakan untuk siswa yang belum mengatur Bacakan
                otomatis sendiri.
            </p>
            <p role="status" className="text-status-visible font-semibold">
                {save.isSuccess && 'Tersimpan.'}
            </p>
            <StudioError error={save.error} />
        </Card>
    );
}

export function StudioView({ id }: { id: number }) {
    const query = useQuery(studioSessionQuery(id));
    const [published, setPublished] = useState(false);
    const [removing, setRemoving] = useState<StudioBlock | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [message, setMessage] = useState({ text: '', count: 0 });
    const [focus, setFocus] = useState<{
        ids: string[];
        version: number;
    } | null>(null);
    const version = query.data?.version;
    useEffect(() => {
        if (!focus || version === undefined || version < focus.version) return;
        focus.ids
            .map((target) => document.getElementById(target))
            .find(Boolean)
            ?.focus();
        setFocus(null);
    }, [focus, version]);
    const report: Report = (text, ids, nextVersion) => {
        setMessage((previous) => ({ text, count: previous.count + 1 }));
        setFocus({ ids, version: nextVersion });
    };
    if (query.isPending) return <p role="status">Memuat sesi…</p>;
    if (query.isError)
        return (
            <div className="space-y-3">
                <RequestError error={query.error} />
                <Button
                    onClick={() => {
                        void query.refetch();
                    }}
                >
                    Muat ulang sesi
                </Button>
            </div>
        );
    const session = query.data;
    const draft = !session.prepared && session.status === 'draft';
    const editable = draft && session.drafting !== 'generating';
    const themeDrafting = session.themes.some(
        ({ drafting }) => drafting === 'generating',
    );
    const baseEditable = editable && !themeDrafting;
    const extras = session.blocks.filter(
        (block) => block.kind === 'extra_challenge',
    );
    const { module } = session;
    const screen = (block: StudioBlock) => (
        <ScreenItem
            key={block.id}
            session={session}
            block={block}
            editable={baseEditable}
            onAskRemove={(chosen) => {
                setRemoving(chosen);
                setConfirming(true);
            }}
            onReport={report}
        />
    );
    return (
        <>
            <Link
                to={`/teacher/materials/${session.material.id}`}
                className={textLink}
            >
                Kembali ke {session.material.title}
            </Link>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold">{session.title}</h1>
                    <p className="text-muted-foreground mt-2 tabular-nums">
                        Modul {module.title}
                        {module.firstPage !== null &&
                            `, halaman ${module.firstPage} sampai ${module.lastPage}`}{' '}
                        · {stateOf(session)}
                        {session.length !== null &&
                            ` · Panjang misi: ${lengthLabels[session.length]}`}
                    </p>
                    {session.summary && (
                        <p className="mt-2 max-w-prose">{session.summary}</p>
                    )}
                </div>
                <p role="status" className="sr-only">
                    {announcementOf(session)}
                </p>
                <p role="status" className="sr-only">
                    <span key={message.count}>{message.text}</span>
                </p>
                <DraftAlert session={session} />
                {session.prepared && (
                    <Alert>
                        Sesi ini disiapkan tim Aku Senang Belajar dan hanya bisa
                        dibaca.
                    </Alert>
                )}
                {session.status === 'ready' && (
                    <AssignCard session={session} takeFocus={published} />
                )}
                {!session.prepared && <ReadAloudCard session={session} />}
                {session.competencies.length > 0 && (
                    <Card>
                        <section
                            aria-labelledby="competencies-title"
                            className="space-y-2"
                        >
                            <h2
                                id="competencies-title"
                                className="text-lg font-semibold"
                            >
                                Kompetensi sesi ini
                            </h2>
                            <ul className="space-y-1">
                                {session.competencies.map((competency) => (
                                    <li key={competency.code}>
                                        <span className="font-semibold">
                                            {competency.code}
                                        </span>{' '}
                                        {competency.description}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </Card>
                )}
                {stepOrder.map((step) => {
                    const blocks = session.blocks.filter(
                        (block) =>
                            block.kind !== 'extra_challenge' &&
                            stepOfKind[block.kind] === step,
                    );
                    if (blocks.length === 0) return null;
                    return (
                        <Card key={step}>
                            <section aria-labelledby={`step-${step}`}>
                                <h2
                                    id={`step-${step}`}
                                    className="text-lg font-semibold"
                                >
                                    {stepLabels[step]}{' '}
                                    <span className="text-muted-foreground ml-1 text-sm font-normal tabular-nums">
                                        {blocks.length} layar
                                    </span>
                                </h2>
                                <ul className="divide-paper-edge divide-y">
                                    {blocks.map(screen)}
                                </ul>
                            </section>
                        </Card>
                    );
                })}
                {extras.length > 0 && (
                    <Card>
                        <section
                            aria-labelledby="extra-title"
                            className="space-y-2"
                        >
                            <h2
                                id="extra-title"
                                className="text-lg font-semibold"
                            >
                                Tantangan tambahan
                            </h2>
                            <p className="text-muted-foreground max-w-prose text-sm">
                                Satu soal latihan sesudah misi. Siswa
                                mendapatkannya di jalur belajar setelah semua
                                kompetensi misi ini berstatus Terlihat.
                                Jawabannya disimpan sebagai latihan, bukan bukti
                                pemahaman. Contoh lain tidak ditampilkan di
                                latihan.
                            </p>
                            <ul className="divide-paper-edge divide-y">
                                {extras.map(screen)}
                            </ul>
                        </section>
                    </Card>
                )}
                {!session.prepared &&
                    session.blocks.length > 0 &&
                    (draft || session.themes.length > 0) && (
                        <ThemesCard session={session} editable={editable} />
                    )}
                {draft && session.blocks.length > 0 && (
                    <RevisionForm
                        session={session}
                        themeDrafting={themeDrafting}
                    />
                )}
                {editable && session.blocks.length > 0 && (
                    <PublishCard
                        session={session}
                        onPublished={() => setPublished(true)}
                    />
                )}
            </div>
            {removing && (
                <RemoveScreenDialog
                    session={session}
                    block={removing}
                    open={confirming}
                    onClose={() => setConfirming(false)}
                    onRemoved={(next) => {
                        setConfirming(false);
                        const successor = next.blocks.find(
                            ({ position }) => position === removing.position,
                        );
                        report(
                            `Layar ${removing.position} dihapus.`,
                            successor ? [`screen-${successor.id}`] : [],
                            next.version,
                        );
                    }}
                />
            )}
        </>
    );
}
