import { useId, useRef, useState } from 'react';
import { BlockEditor } from './block-editor';
import { diagramFields, type EditableBlock } from './block-fields';
import { BlockView } from './block-view';
import {
    useChooseThemes,
    useEditThemeBlock,
    useMarkThemeRead,
    useRedraftTheme,
    useRemoveTheme,
    type StudioSession,
    type StudioTheme,
} from './queries';
import { StudioError } from './studio-error';
import {
    choiceBox,
    choiceCard,
    failures,
    focusHeading,
    kindLabels,
    stepOfKind,
    themeLabel,
    themeLabels,
} from './studio-labels';
import { TextAreaField, fieldErrorText } from '../../components/form-field';
import { Sticker } from '../../components/sticker';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { cn } from '../../lib/cn';
import { stepLabels, stepOrder } from '../learning-sessions/steps';
import { interests, type Interest } from '../profile/interests';

const MAX_THEMES = 3;

function transitions(before: StudioTheme[], after: StudioTheme[]) {
    const drafting = new Set(
        before
            .filter(({ drafting }) => drafting === 'generating')
            .map(({ theme }) => theme),
    );
    const settled = after.filter(({ theme }) => drafting.has(theme));
    const ready = settled
        .filter(({ drafting }) => drafting === null)
        .map(({ theme }) => theme);
    const failed = settled
        .filter(({ drafting }) => drafting === 'failed')
        .map(({ theme }) => theme);
    return [
        ready.length > 0 && `Tema ${themeLabels(ready)} siap dibaca.`,
        failed.length > 0 &&
            `Tema ${themeLabels(failed)} belum berhasil ditulis.`,
    ]
        .filter(Boolean)
        .join(' ');
}

function ThemePicker({
    session,
    choose,
    onChoose,
}: {
    session: StudioSession;
    choose: ReturnType<typeof useChooseThemes>;
    onChoose: (themes: Interest[]) => void;
}) {
    const [picked, setPicked] = useState<Interest[]>([]);
    const chosen = new Set(session.themes.map(({ theme }) => theme));
    const ticked = picked.filter((key) => !chosen.has(key));
    const left = MAX_THEMES - session.themes.length;
    const students = new Map(
        session.interests.map(({ key, students }) => [key, students]),
    );
    const error = fieldErrorText(choose.error, 'themes');
    return (
        <form
            className="space-y-4"
            onSubmit={(event) => {
                event.preventDefault();
                onChoose(ticked);
            }}
        >
            <fieldset
                aria-describedby={error ? 'themes-error' : undefined}
                className="space-y-2"
            >
                <legend className="mb-2 font-medium">
                    Pilih paling banyak {left} minat
                </legend>
                <div className="grid gap-2 @xl:grid-cols-2">
                    {interests
                        .filter(({ key }) => !chosen.has(key))
                        .map(({ key, label, tint, drawing }) => {
                            const count = students.get(key) ?? 0;
                            const checked = ticked.includes(key);
                            return (
                                <label
                                    key={key}
                                    className={cn(
                                        choiceCard,
                                        'items-center has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        name="themes"
                                        value={key}
                                        checked={checked}
                                        disabled={
                                            !checked && ticked.length >= left
                                        }
                                        onChange={() =>
                                            setPicked(
                                                checked
                                                    ? ticked.filter(
                                                          (item) =>
                                                              item !== key,
                                                      )
                                                    : [...ticked, key],
                                            )
                                        }
                                        className={cn(choiceBox, 'mt-0')}
                                    />
                                    <Sticker tint={tint} className="size-10">
                                        {drawing}
                                    </Sticker>
                                    <span>
                                        {label}{' '}
                                        <span className="text-muted-foreground text-sm tabular-nums">
                                            ·{' '}
                                            {count > 0
                                                ? `${count} siswa`
                                                : 'belum ada siswa'}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                </div>
            </fieldset>
            {error ? (
                <p id="themes-error" role="alert" className="text-destructive">
                    {error}
                </p>
            ) : (
                <StudioError error={choose.error} />
            )}
            <Button type="submit" disabled={choose.isPending}>
                {choose.isPending ? 'Mengirim…' : 'Susun tema'}
            </Button>
        </form>
    );
}

function ThemeScreen({
    sessionId,
    theme,
    base,
    content,
    editable,
}: {
    sessionId: number;
    theme: Interest;
    base: EditableBlock;
    content: Record<string, unknown> | undefined;
    editable: boolean;
}) {
    const save = useEditThemeBlock(sessionId, theme);
    const [editing, setEditing] = useState(false);
    const toggle = useRef<HTMLButtonElement>(null);
    const label = themeLabel(theme);
    const themed = content && ({ ...base, content } as EditableBlock);
    const close = () => {
        setEditing(false);
        toggle.current?.focus();
    };
    return (
        <li className="space-y-3 py-4">
            <h5 className="font-semibold">
                Layar {base.position} · {kindLabels[base.kind]}
            </h5>
            <div className="grid gap-4 @3xl:grid-cols-2">
                <section
                    aria-label="Misi dasar"
                    className="border-paper-edge space-y-3 rounded-lg border p-4"
                >
                    <p className="text-muted-foreground text-sm font-semibold">
                        Misi dasar
                    </p>
                    <BlockView block={base} layout="stacked" />
                </section>
                <section
                    aria-label={`Tema ${label}`}
                    className="border-paper-edge space-y-3 rounded-lg border p-4"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-muted-foreground text-sm font-semibold">
                            Tema {label}
                        </p>
                        {editable && themed && (
                            <Button
                                ref={toggle}
                                variant="outline"
                                aria-expanded={editing}
                                aria-label={`Ubah teks layar ${base.position} tema ${label}`}
                                onClick={() => {
                                    save.reset();
                                    setEditing(!editing);
                                }}
                            >
                                Ubah teks
                            </Button>
                        )}
                    </div>
                    {!themed ? (
                        <p className="text-muted-foreground">
                            Layar ini belum ditulis untuk tema ini.
                        </p>
                    ) : editable && editing ? (
                        <BlockEditor
                            block={themed}
                            save={save}
                            idPrefix={`theme-${theme}-${base.id}`}
                            answerFixed
                            onClose={close}
                        />
                    ) : (
                        <>
                            <BlockView block={themed} layout="stacked" />
                            {diagramFields(base).length > 0 && (
                                <p className="text-muted-foreground text-sm">
                                    Gambar sama dengan misi dasar.
                                </p>
                            )}
                        </>
                    )}
                </section>
            </div>
        </li>
    );
}

function ThemeCompare({
    session,
    theme,
    editable,
    onRead,
}: {
    session: StudioSession;
    theme: StudioTheme;
    editable: boolean;
    onRead: () => void;
}) {
    const read = useMarkThemeRead(session.id, theme.theme);
    const bases = session.blocks.filter(
        (block): block is EditableBlock => block.kind !== 'brain_game',
    );
    const contents = new Map(
        theme.blocks.map(({ id, content }) => [id, content]),
    );
    const extras = bases.filter((block) => block.kind === 'extra_challenge');
    const canRead =
        editable &&
        theme.drafting === null &&
        !theme.mismatch &&
        !theme.read &&
        theme.complete;
    return (
        <div className="@container space-y-4">
            {stepOrder.map((step) => {
                const blocks = bases.filter(
                    (block) =>
                        block.kind !== 'extra_challenge' &&
                        stepOfKind[block.kind] === step,
                );
                if (blocks.length === 0) return null;
                const id = `theme-${theme.theme}-step-${step}`;
                return (
                    <section key={step} aria-labelledby={id}>
                        <h4 id={id} className="font-semibold">
                            {stepLabels[step]}
                        </h4>
                        <ul className="divide-paper-edge divide-y">
                            {blocks.map((block) => (
                                <ThemeScreen
                                    key={block.id}
                                    sessionId={session.id}
                                    theme={theme.theme}
                                    base={block}
                                    content={contents.get(block.id)}
                                    editable={
                                        editable &&
                                        theme.drafting !== 'generating'
                                    }
                                />
                            ))}
                        </ul>
                    </section>
                );
            })}
            {extras.length > 0 && (
                <section aria-labelledby={`theme-${theme.theme}-extra`}>
                    <h4
                        id={`theme-${theme.theme}-extra`}
                        className="font-semibold"
                    >
                        Tantangan tambahan
                    </h4>
                    <ul className="divide-paper-edge divide-y">
                        {extras.map((block) => (
                            <ThemeScreen
                                key={block.id}
                                sessionId={session.id}
                                theme={theme.theme}
                                base={block}
                                content={contents.get(block.id)}
                                editable={
                                    editable && theme.drafting !== 'generating'
                                }
                            />
                        ))}
                    </ul>
                </section>
            )}
            {canRead && (
                <div className="space-y-3">
                    <StudioError error={read.error} />
                    <Button
                        disabled={read.isPending}
                        onClick={() =>
                            read.mutate(session.version, { onSuccess: onRead })
                        }
                    >
                        {read.isPending ? 'Menyimpan…' : 'Tandai sudah dibaca'}
                    </Button>
                </div>
            )}
        </div>
    );
}

function ThemeState({ theme }: { theme: StudioTheme }) {
    if (theme.drafting === 'generating')
        return (
            <Alert>
                <p className="font-semibold">Sedang ditulis AI…</p>
                <p className="mt-1">
                    Halaman ini berganti sendiri saat temanya siap.
                </p>
            </Alert>
        );
    if (theme.drafting === 'failed')
        return (
            <Alert tone="attention">
                {failures[theme.draftError ?? ''] ??
                    'Terjadi gangguan di server.'}
                {theme.blocks.length > 0 && (
                    <> Layar di bawah masih versi sebelumnya.</>
                )}
            </Alert>
        );
    if (theme.mismatch)
        return (
            <Alert tone="attention">
                Tidak cocok lagi dengan misi dasar. Tulis ulang temanya.
            </Alert>
        );
    return (
        <p className="text-muted-foreground">
            {theme.read ? 'Sudah dibaca' : 'Belum dibaca'}
        </p>
    );
}

function ThemeItem({
    session,
    theme,
    editable,
    open,
    onToggle,
    onRemove,
    onAnnounce,
}: {
    session: StudioSession;
    theme: StudioTheme;
    editable: boolean;
    open: boolean;
    onToggle: () => void;
    onRemove: () => void;
    onAnnounce: (message: string) => void;
}) {
    const redraft = useRedraftTheme(session.id, theme.theme);
    const [rewriting, setRewriting] = useState(false);
    const [note, setNote] = useState('');
    const heading = useRef<HTMLHeadingElement>(null);
    const label = themeLabel(theme.theme);
    const generating = theme.drafting === 'generating';
    const readable = !generating && theme.blocks.length > 0;
    return (
        <li className="space-y-3 py-4">
            <h3
                ref={heading}
                tabIndex={-1}
                className={cn(focusHeading, 'font-semibold')}
            >
                {label}
            </h3>
            <ThemeState theme={theme} />
            <div className="flex flex-wrap gap-3">
                {readable && (
                    <Button
                        variant="outline"
                        aria-expanded={open}
                        aria-label={`Baca berdampingan tema ${label}`}
                        onClick={onToggle}
                    >
                        Baca berdampingan
                    </Button>
                )}
                {editable && !generating && (
                    <Button
                        variant="outline"
                        aria-expanded={rewriting}
                        aria-label={`Tulis ulang tema ${label}`}
                        onClick={() => {
                            redraft.reset();
                            setRewriting(!rewriting);
                        }}
                    >
                        Tulis ulang
                    </Button>
                )}
                {editable && (
                    <Button
                        variant="outline"
                        className="text-destructive"
                        aria-label={`Hapus tema ${label}`}
                        onClick={onRemove}
                    >
                        Hapus tema
                    </Button>
                )}
            </div>
            {editable && rewriting && !generating && (
                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        const text = String(
                            new FormData(event.currentTarget).get('note') ?? '',
                        ).trim();
                        setNote(text);
                        redraft.mutate(text, {
                            onSuccess: () => {
                                setRewriting(false);
                                onAnnounce(
                                    `AI mulai menulis ulang tema ${label}.`,
                                );
                                heading.current?.focus();
                            },
                        });
                    }}
                >
                    <TextAreaField
                        name="note"
                        id={`theme-${theme.theme}-note`}
                        label="Yang perlu diubah di tema ini"
                        rows={3}
                        maxLength={500}
                        defaultValue={note}
                        error={redraft.error}
                    />
                    <StudioError error={redraft.error} inline={['note']} />
                    <Button type="submit" disabled={redraft.isPending}>
                        {redraft.isPending ? 'Mengirim…' : 'Tulis ulang tema'}
                    </Button>
                </form>
            )}
            {open && readable && (
                <ThemeCompare
                    session={session}
                    theme={theme}
                    editable={editable}
                    onRead={() => {
                        onAnnounce(`Tema ${label} sudah dibaca.`);
                        heading.current?.focus();
                    }}
                />
            )}
        </li>
    );
}

function RemoveThemeDialog({
    theme,
    open,
    remove,
    onClose,
    onClosed,
    onConfirm,
}: {
    theme: Interest;
    open: boolean;
    remove: ReturnType<typeof useRemoveTheme>;
    onClose: () => void;
    onClosed: () => void;
    onConfirm: () => void;
}) {
    const titleId = useId();
    const descriptionId = useId();
    const label = themeLabel(theme);
    return (
        <Dialog
            open={open}
            onClose={(dialog) => {
                if (remove.isPending) {
                    if (!dialog.open) dialog.showModal();
                    return;
                }
                onClose();
                onClosed();
            }}
            onCancel={(event) => {
                if (remove.isPending) event.preventDefault();
            }}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
        >
            <h2 id={titleId} className="text-primary-deep text-xl font-bold">
                Hapus tema {label}?
            </h2>
            <p
                id={descriptionId}
                className="text-muted-foreground mt-4 leading-relaxed"
            >
                Semua layar tema ini ikut terhapus.
            </p>
            <div className="mt-5 space-y-4">
                <StudioError error={remove.error} />
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="outline"
                        autoFocus
                        disabled={remove.isPending}
                        onClick={onClose}
                    >
                        Batal
                    </Button>
                    <Button
                        variant="destructive"
                        aria-disabled={remove.isPending}
                        className="aria-disabled:opacity-60"
                        onClick={() => {
                            if (!remove.isPending) onConfirm();
                        }}
                    >
                        {remove.isPending ? 'Menghapus…' : 'Hapus tema'}
                    </Button>
                </div>
            </div>
        </Dialog>
    );
}

export function ThemesCard({
    session,
    editable,
}: {
    session: StudioSession;
    editable: boolean;
}) {
    const choose = useChooseThemes(session.id);
    const remove = useRemoveTheme(session.id);
    const heading = useRef<HTMLHeadingElement>(null);
    const [message, setMessage] = useState('');
    const [seen, setSeen] = useState(session.themes);
    const [open, setOpen] = useState<Interest | null>(null);
    const [removing, setRemoving] = useState<{
        theme: Interest;
        open: boolean;
    } | null>(null);
    if (seen !== session.themes) {
        setSeen(session.themes);
        const change = transitions(seen, session.themes);
        if (change) setMessage(change);
    }
    const full = session.themes.length >= MAX_THEMES;
    return (
        <Card>
            <section aria-labelledby="themes-title" className="space-y-4">
                <div>
                    <h2
                        id="themes-title"
                        ref={heading}
                        tabIndex={-1}
                        className={cn(focusHeading, 'text-lg font-semibold')}
                    >
                        Tema cerita
                    </h2>
                    <p className="text-muted-foreground mt-1 max-w-prose">
                        AI menulis ulang setiap layar dengan suasana minat
                        siswa. Pilihan jawaban, jawaban benar, angka, dan gambar
                        tetap sama. Siswa mendapat tema dari minatnya; siswa
                        tanpa minat yang cocok mendapat misi dasar. Siswa yang
                        cocok dengan beberapa tema mendapat tema yang paling
                        atas dalam daftar ini.
                    </p>
                </div>
                {session.themes.length > 0 && (
                    <ul className="divide-paper-edge divide-y">
                        {session.themes.map((theme) => (
                            <ThemeItem
                                key={theme.theme}
                                session={session}
                                theme={theme}
                                editable={editable}
                                open={open === theme.theme}
                                onToggle={() =>
                                    setOpen(
                                        open === theme.theme
                                            ? null
                                            : theme.theme,
                                    )
                                }
                                onRemove={() => {
                                    remove.reset();
                                    setRemoving({
                                        theme: theme.theme,
                                        open: true,
                                    });
                                }}
                                onAnnounce={setMessage}
                            />
                        ))}
                    </ul>
                )}
                {editable &&
                    (full ? (
                        <p className="text-muted-foreground">
                            Misi ini sudah punya tiga tema. Hapus satu tema
                            untuk memilih minat lain.
                        </p>
                    ) : (
                        <div className="@container">
                            <ThemePicker
                                session={session}
                                choose={choose}
                                onChoose={(themes) =>
                                    choose.mutate(themes, {
                                        onSuccess: () => {
                                            setMessage(
                                                `AI mulai menulis tema ${themeLabels(themes)}.`,
                                            );
                                            heading.current?.focus();
                                        },
                                    })
                                }
                            />
                        </div>
                    ))}
                {removing && (
                    <RemoveThemeDialog
                        theme={removing.theme}
                        open={removing.open}
                        remove={remove}
                        onClose={() =>
                            setRemoving({ ...removing, open: false })
                        }
                        onClosed={() => {
                            if (
                                session.themes.some(
                                    ({ theme }) => theme === removing.theme,
                                )
                            )
                                return;
                            heading.current?.focus();
                        }}
                        onConfirm={() =>
                            remove.mutate(removing.theme, {
                                onSuccess: () => {
                                    setMessage(
                                        `Tema ${themeLabel(removing.theme)} dihapus.`,
                                    );
                                    setRemoving({ ...removing, open: false });
                                },
                            })
                        }
                    />
                )}
                <p role="status" className="sr-only">
                    {message}
                </p>
            </section>
        </Card>
    );
}
