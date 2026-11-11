import {
    type FormEvent,
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { subjects } from '../assignments/subject-art';
import type { Adaptation } from '../learning-sessions/queries';
import { choiceBox, choiceCard, focusHeading } from '../studio/studio-labels';
import {
    type AdaptationBody,
    type AdaptationItem,
    useSetAdaptation,
} from './queries';

const day = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' });

const helpParts = { example: 'contoh lain dulu', hint: 'petunjuk dulu' };
const leadParts = {
    text: 'teks dulu',
    audio: 'dibacakan otomatis',
    visual: 'gambar dulu',
};

export function adaptationParts(
    pair: Adaptation,
    audio: string = leadParts.audio,
) {
    return [
        pair.helpFirst && helpParts[pair.helpFirst],
        pair.lead && (pair.lead === 'audio' ? audio : leadParts[pair.lead]),
    ]
        .filter((part) => part !== null)
        .join(' · ');
}

const helpLabels = { hint: 'Petunjuk', example: 'Contoh lain' };
const leadLabels = { text: 'Teks', audio: 'Suara', visual: 'Gambar' };
const leadChoices = [
    { value: '', label: 'Biasa' },
    { value: 'text', label: leadLabels.text },
    { value: 'audio', label: leadLabels.audio },
    { value: 'visual', label: leadLabels.visual },
];

const chose = (pair: Adaptation) =>
    pair.helpFirst !== null || pair.lead !== null;

function leadValue(item: AdaptationItem) {
    if (item.lead === null) return 'Biasa';
    if (item.lead === 'audio' && item.readAloudChosen) {
        return 'Suara (tidak dipakai: siswa mengatur Bacakan otomatis sendiri)';
    }
    return leadLabels[item.lead];
}

function Suggested({ ai }: { ai: NonNullable<AdaptationItem['ai']> }) {
    return (
        <>
            {adaptationParts(ai)}. {ai.reason}
        </>
    );
}

function SourceLine({ item }: { item: AdaptationItem }) {
    const { ai } = item;

    if (item.off) {
        return (
            <p className="text-muted-foreground">
                Dimatikan. Misi berikutnya memakai urutan biasa.
            </p>
        );
    }

    if (item.teacher) {
        return (
            <p className="leading-relaxed">
                Diatur guru, {day.format(new Date(item.teacher.setAt))}.
                {ai && chose(ai) && (
                    <>
                        {' '}
                        <span className="text-ai-suggestion font-medium">
                            Saran AI terbaru:
                        </span>{' '}
                        <Suggested ai={ai} />
                    </>
                )}
            </p>
        );
    }

    if (!ai) return null;

    return (
        <p className="leading-relaxed">
            <span className="text-ai-suggestion font-medium">Saran AI:</span>{' '}
            {chose(ai) ? (
                <Suggested ai={ai} />
            ) : (
                'bukti belum menunjukkan satu arah, jadi misi berikutnya memakai urutan biasa.'
            )}
        </p>
    );
}

function StateLine({ item }: { item: AdaptationItem }) {
    if (item.off) return null;

    if (item.pending) {
        return (
            <p className="text-muted-foreground text-sm">
                AI sedang menimbang ringkasan terbaru. Bagian ini memperbarui
                sendiri.
            </p>
        );
    }

    if (item.failed) {
        return <Alert tone="attention">Saran AI belum berhasil disusun.</Alert>;
    }

    if (item.ai) return null;

    return (
        <p className="text-muted-foreground text-sm">
            {item.thin
                ? 'Belum ada saran. AI menunggu setidaknya dua ringkasan misi di mata pelajaran ini.'
                : 'Belum ada saran AI.'}
        </p>
    );
}

function AdaptationRow({
    classId,
    studentId,
    item,
    announce,
}: {
    classId: number;
    studentId: number;
    item: AdaptationItem;
    announce: (message: string) => void;
}) {
    const set = useSetAdaptation(classId, studentId);
    const [editing, setEditing] = useState(false);
    const heading = useRef<HTMLHeadingElement>(null);
    const settle = useRef<HTMLButtonElement>(null);
    const formId = useId();
    const label = subjects[item.subject].label;
    const headingId = `helped-${item.subject}`;
    const prefill = item.teacher ?? item;
    const wasPending = useRef(item.pending);

    useEffect(() => {
        if (wasPending.current && !item.pending) {
            announce(
                item.failed
                    ? `Saran AI ${label} belum berhasil disusun.`
                    : `Saran AI ${label} sudah siap.`,
            );
        }
        wasPending.current = item.pending;
    }, [item.pending, item.failed, label, announce]);

    const send = (
        body: AdaptationBody,
        message: string,
        focus: 'heading' | 'settle',
    ) =>
        set.mutate(
            { subject: item.subject, body },
            {
                onSuccess: () => {
                    setEditing(false);
                    announce(message);
                    (focus === 'heading' ? heading : settle).current?.focus();
                },
            },
        );
    const save = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const lead = data.get('lead');

        send(
            {
                helpFirst:
                    data.get('helpFirst') === 'example' ? 'example' : 'hint',
                lead:
                    lead === 'text' || lead === 'audio' || lead === 'visual'
                        ? lead
                        : null,
            },
            item.off
                ? `Pengaturan ${label} disimpan dan dinyalakan lagi.`
                : `Pengaturan ${label} disimpan.`,
            'settle',
        );
    };
    const close = () => {
        setEditing(false);
        settle.current?.focus();
    };

    return (
        <li className="space-y-3 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <h3
                    id={headingId}
                    ref={heading}
                    tabIndex={-1}
                    className={`py-2 font-semibold ${focusHeading}`}
                >
                    {label}
                </h3>
                <div className="flex flex-wrap gap-2 print:hidden">
                    <Button
                        ref={settle}
                        variant="outline"
                        className="min-h-11"
                        aria-expanded={editing}
                        aria-controls={formId}
                        aria-label={`Atur yang membantu untuk ${label}`}
                        onClick={() => setEditing(!editing)}
                    >
                        Atur
                    </Button>
                    <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={set.isPending}
                        aria-label={
                            item.off
                                ? `Nyalakan lagi penyesuaian ${label}`
                                : `Matikan penyesuaian ${label}`
                        }
                        onClick={() =>
                            item.off
                                ? send(
                                      { off: false },
                                      `Penyesuaian ${label} dinyalakan lagi.`,
                                      'heading',
                                  )
                                : send(
                                      { off: true },
                                      `Penyesuaian ${label} dimatikan.`,
                                      'heading',
                                  )
                        }
                    >
                        {item.off ? 'Nyalakan lagi' : 'Matikan'}
                    </Button>
                    {item.source === 'teacher' && (
                        <Button
                            variant="outline"
                            className="min-h-11"
                            disabled={set.isPending}
                            aria-label={`Kembali ke saran AI untuk ${label}`}
                            onClick={() =>
                                send(
                                    { source: 'ai' },
                                    `${label} kembali memakai saran AI.`,
                                    'heading',
                                )
                            }
                        >
                            Kembali ke saran AI
                        </Button>
                    )}
                    {item.failed && !item.off && (
                        <Button
                            variant="outline"
                            className="min-h-11"
                            disabled={set.isPending}
                            aria-label={`Susun ulang saran ${label}`}
                            onClick={() =>
                                send(
                                    { off: false },
                                    `Saran AI ${label} disusun ulang.`,
                                    'heading',
                                )
                            }
                        >
                            Susun ulang saran
                        </Button>
                    )}
                </div>
            </div>
            <dl className="grid gap-2 @xl:grid-cols-2">
                <div>
                    <dt className="text-muted-foreground text-sm">
                        Bantuan pertama
                    </dt>
                    <dd className="font-medium">
                        {item.helpFirst
                            ? helpLabels[item.helpFirst]
                            : 'Petunjuk (urutan biasa)'}
                    </dd>
                </div>
                <div>
                    <dt className="text-muted-foreground text-sm">
                        Bentuk utama
                    </dt>
                    <dd className="font-medium">{leadValue(item)}</dd>
                </div>
            </dl>
            <SourceLine item={item} />
            <StateLine item={item} />
            {editing && (
                <form
                    id={formId}
                    aria-labelledby={headingId}
                    className="bg-muted/50 space-y-4 rounded-lg p-4 print:hidden"
                    onSubmit={save}
                >
                    <fieldset className="space-y-2">
                        <legend className="mb-2 font-semibold">
                            Bantuan pertama
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {(['hint', 'example'] as const).map((value) => (
                                <label key={value} className={choiceCard}>
                                    <input
                                        type="radio"
                                        name="helpFirst"
                                        value={value}
                                        defaultChecked={
                                            (prefill.helpFirst ?? 'hint') ===
                                            value
                                        }
                                        className={choiceBox}
                                    />
                                    {helpLabels[value]}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <fieldset className="space-y-2">
                        <legend className="mb-2 font-semibold">
                            Bentuk utama
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {leadChoices.map((choice) => (
                                <label
                                    key={choice.value}
                                    className={choiceCard}
                                >
                                    <input
                                        type="radio"
                                        name="lead"
                                        value={choice.value}
                                        defaultChecked={
                                            (prefill.lead ?? '') ===
                                            choice.value
                                        }
                                        className={choiceBox}
                                    />
                                    {choice.label}
                                </label>
                            ))}
                        </div>
                        <p className="text-muted-foreground text-sm">
                            Teks menaruh teks sebelum gambarnya. Suara
                            membacakan layar otomatis, kecuali siswa sudah
                            mengatur Bacakan otomatis sendiri. Gambar menaruh
                            gambar lebih dulu, juga di tantangan.
                        </p>
                    </fieldset>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="submit"
                            className="min-h-11"
                            disabled={set.isPending}
                        >
                            {set.isPending ? 'Menyimpan…' : 'Simpan'}
                        </Button>
                        <Button
                            variant="outline"
                            className="min-h-11"
                            onClick={close}
                        >
                            Batal
                        </Button>
                    </div>
                </form>
            )}
            <RequestError error={set.error} />
        </li>
    );
}

export function Adaptations({
    classId,
    studentId,
    items,
}: {
    classId: number;
    studentId: number;
    items: AdaptationItem[];
}) {
    const [message, setMessage] = useState({ text: '', count: 0 });
    const announce = useCallback(
        (text: string) =>
            setMessage((previous) => ({ text, count: previous.count + 1 })),
        [],
    );

    return (
        <Card>
            <section
                aria-labelledby="helped-title"
                className="@container space-y-4"
            >
                <div className="space-y-1">
                    <h2 id="helped-title" className="text-lg font-semibold">
                        Yang membantu
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Bantuan dan bentuk yang didahulukan di misi berikutnya,
                        per mata pelajaran. Siswa tetap bisa membuka semua
                        bantuan dan bentuk, dan tidak melihat label ini.
                    </p>
                </div>
                {items.length === 0 ? (
                    <p>Belum ada misi di kelas ini.</p>
                ) : (
                    <ul className="divide-paper-edge divide-y">
                        {items.map((item) => (
                            <AdaptationRow
                                key={item.subject}
                                classId={classId}
                                studentId={studentId}
                                item={item}
                                announce={announce}
                            />
                        ))}
                    </ul>
                )}
                <p role="status" className="sr-only">
                    <span key={message.count}>{message.text}</span>
                </p>
            </section>
        </Card>
    );
}
