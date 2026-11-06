import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { BlockEditor } from './block-editor';
import { BlockView } from './block-view';
import {
    studioSessionQuery,
    useReviseSession,
    type StudioBlock,
    type StudioSession,
} from './queries';
import { StudioError } from './studio-error';
import { TextAreaField } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { textLink } from '../../components/ui/text-link';
import type { Step } from '../learning-sessions/queries';
import { stepLabels, stepOrder } from '../learning-sessions/steps';

const kindLabels: Record<StudioBlock['kind'], string> = {
    brain_game: 'Permainan memori',
    hook: 'Pertanyaan pembuka',
    story: 'Cerita',
    check: 'Soal cek',
    challenge: 'Tantangan',
    reflection: 'Refleksi',
};

const stepOfKind: Record<StudioBlock['kind'], Step> = {
    brain_game: 'opening',
    hook: 'opening',
    story: 'story',
    check: 'story',
    challenge: 'challenge',
    reflection: 'reflection',
};

const failures: Record<string, string> = {
    invalid_output: 'Jawaban AI belum memenuhi aturan sesi.',
    timeout: 'AI terlalu lama menjawab.',
    network: 'AI belum bisa dihubungi.',
    http: 'AI belum bisa dihubungi.',
    interrupted: 'Server dimulai ulang saat AI sedang bekerja.',
    not_configured: 'AI belum diatur di server ini.',
};

function stateOf(session: StudioSession) {
    if (session.prepared) return 'Disiapkan tim Aku Senang Belajar';
    if (session.status === 'ready') return 'Siap ditugaskan';
    if (session.version === 0) return 'Belum ada draf';
    return `Draf versi ${session.version}`;
}

function announcementOf(session: StudioSession) {
    if (session.drafting === 'generating') return 'AI sedang menyusun sesi.';
    if (session.drafting === 'failed') return 'Penyusunan sesi belum berhasil.';
    if (session.prepared || session.version === 0) return '';
    return `Draf versi ${session.version} siap ditinjau.`;
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

function ScreenItem({
    sessionId,
    block,
    editable,
}: {
    sessionId: number;
    block: StudioBlock;
    editable: boolean;
}) {
    const [editing, setEditing] = useState(false);
    const toggle = useRef<HTMLButtonElement>(null);
    const close = () => {
        setEditing(false);
        toggle.current?.focus();
    };
    return (
        <li className="space-y-3 py-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div>
                    <h3 className="font-semibold">
                        Layar {block.position} · {kindLabels[block.kind]}
                    </h3>
                    <p className="text-muted-foreground text-sm tabular-nums">
                        {metaOf(block)}
                    </p>
                </div>
                {editable && block.kind !== 'brain_game' && (
                    <Button
                        ref={toggle}
                        variant="outline"
                        aria-expanded={editing}
                        onClick={() => setEditing(!editing)}
                    >
                        Ubah teks
                    </Button>
                )}
            </div>
            {editable && editing && block.kind !== 'brain_game' ? (
                <BlockEditor
                    sessionId={sessionId}
                    block={block}
                    onClose={close}
                />
            ) : (
                <BlockView block={block} />
            )}
        </li>
    );
}

function RevisionForm({ session }: { session: StudioSession }) {
    const revise = useReviseSession(session.id);
    const generating = session.drafting === 'generating';
    return (
        <Card>
            <section aria-labelledby="revision-title" className="space-y-4">
                <div>
                    <h2 id="revision-title" className="text-lg font-semibold">
                        Minta revisi
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        AI menulis ulang seluruh sesi dari draf ini. Teks yang
                        sudah Anda ubah ikut dikirim, tetapi AI bisa ikut
                        mengubahnya.
                    </p>
                </div>
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
                        hint="Contoh: pakai contoh kue, bukan roti. Kosongkan bila AI perlu menyusun ulang dari awal."
                        rows={3}
                        maxLength={500}
                        disabled={generating}
                        error={revise.error}
                    />
                    <StudioError error={revise.error} inline={['note']} />
                    <Button
                        type="submit"
                        disabled={generating || revise.isPending}
                    >
                        {revise.isPending ? 'Mengirim…' : 'Minta revisi'}
                    </Button>
                </form>
            </section>
        </Card>
    );
}

export function StudioView({ id }: { id: number }) {
    const query = useQuery(studioSessionQuery(id));
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
    const { module } = session;
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
                    </p>
                    {session.summary && (
                        <p className="mt-2 max-w-prose">{session.summary}</p>
                    )}
                </div>
                <p role="status" className="sr-only">
                    {announcementOf(session)}
                </p>
                <DraftAlert session={session} />
                {session.prepared && (
                    <Alert>
                        Sesi ini disiapkan tim Aku Senang Belajar dan hanya bisa
                        dibaca.
                    </Alert>
                )}
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
                                Kompetensi modul
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
                        (block) => stepOfKind[block.kind] === step,
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
                                    {blocks.map((block) => (
                                        <ScreenItem
                                            key={block.id}
                                            sessionId={session.id}
                                            block={block}
                                            editable={editable}
                                        />
                                    ))}
                                </ul>
                            </section>
                        </Card>
                    );
                })}
                {draft && session.blocks.length > 0 && (
                    <RevisionForm session={session} />
                )}
            </div>
        </>
    );
}
