import { useQuery } from '@tanstack/react-query';
import {
    type FormEvent,
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { fieldErrorText } from '../../components/form-field';
import { RequestError } from '../../components/request-error';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { useMinutesLeft } from '../../lib/use-minutes-left';
import { stepLabels, stepOrder } from '../learning-sessions/steps';
import { choiceBox, choiceCard, focusHeading } from '../studio/studio-labels';
import {
    liveConflict,
    liveMonitorQuery,
    running,
    useLiveAction,
    type Live,
    type LiveAction,
    type LiveMonitor,
} from './queries';

const modeLabels = { together: 'Bersama', own_pace: 'Mandiri' };
const modeHelp = {
    together: 'Anda membuka langkah satu per satu.',
    own_pace: 'Siswa maju sendiri.',
};
const stateLabels = {
    not_started: 'Belum mulai',
    active: 'Aktif',
    offline: 'Offline',
    done: 'Selesai',
};
const busy = 'aria-disabled:opacity-60';

type Run = (
    action: LiveAction,
    announcement: string,
    focus?: 'card' | 'requests',
) => void;

function StartForm({
    lastEnded,
    error,
    pending,
    run,
}: {
    lastEnded: boolean;
    error: unknown;
    pending: boolean;
    run: Run;
}) {
    const start = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const minutes = data.get('minutes');

        run(
            {
                do: 'open',
                mode: data.get('mode') === 'own_pace' ? 'own_pace' : 'together',
                minutes:
                    typeof minutes === 'string' && minutes
                        ? Number(minutes)
                        : undefined,
            },
            'Sesi langsung dimulai.',
            'card',
        );
    };

    return (
        <form className="space-y-4" onSubmit={start}>
            {lastEnded && (
                <p className="text-muted-foreground">
                    Sesi langsung terakhir sudah selesai.
                </p>
            )}
            <fieldset>
                <legend className="mb-2 font-semibold">Cara menjalankan</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                    {(['together', 'own_pace'] as const).map((mode) => (
                        <label key={mode} className={choiceCard}>
                            <input
                                type="radio"
                                name="mode"
                                value={mode}
                                defaultChecked={mode === 'together'}
                                className={choiceBox}
                            />
                            <span>
                                <span className="block font-medium">
                                    {modeLabels[mode]}
                                </span>
                                <span className="block text-sm">
                                    {modeHelp[mode]}
                                </span>
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>
            <div className="space-y-2">
                <label htmlFor="live-minutes" className="block font-medium">
                    Batas waktu (menit)
                </label>
                <Input
                    id="live-minutes"
                    name="minutes"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={120}
                    aria-invalid={fieldErrorText(error, 'minutes') !== null}
                    aria-describedby="live-minutes-hint"
                    className="max-w-40"
                />
                <p
                    id="live-minutes-hint"
                    className="text-muted-foreground text-sm"
                >
                    Boleh dikosongkan. Isi 5 sampai 120 menit.
                </p>
            </div>
            <Button type="submit" aria-disabled={pending} className={busy}>
                {pending ? 'Memulai…' : 'Mulai sesi langsung'}
            </Button>
        </form>
    );
}

function LivePanel({
    live,
    monitor,
    stale,
    pending,
    run,
    onEnd,
    requestsHeading,
}: {
    live: Live;
    monitor: LiveMonitor;
    stale: boolean;
    pending: boolean;
    run: Run;
    onEnd: () => void;
    requestsHeading: RefObject<HTMLHeadingElement | null>;
}) {
    const paused = live.state === 'paused';
    const together = live.mode === 'together';
    const next = together
        ? stepOrder.at(stepOrder.indexOf(live.openStep) + 1)
        : undefined;
    const minutes = useMinutesLeft(paused ? null : live.endsAt);
    const time =
        live.endsAt === null
            ? 'Tanpa batas waktu'
            : paused
              ? 'Waktu berhenti selama jeda'
              : minutes !== null && `Sisa ${minutes} menit`;

    return (
        <>
            <div className="space-y-1">
                <p className="font-semibold">
                    {paused ? 'Dijeda' : 'Sedang berjalan'}
                </p>
                <p>Mode: {modeLabels[live.mode]}</p>
                {together && (
                    <p>Langkah terbuka: {stepLabels[live.openStep]}</p>
                )}
                {time && <p className="tabular-nums">{time}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    aria-disabled={pending}
                    className={busy}
                    onClick={() =>
                        paused
                            ? run({ do: 'resume' }, 'Sesi berjalan lagi.')
                            : run({ do: 'pause' }, 'Sesi dijeda.')
                    }
                >
                    {paused ? 'Lanjutkan' : 'Jeda'}
                </Button>
                {next && (
                    <Button
                        disabled={paused}
                        aria-disabled={pending}
                        className={busy}
                        onClick={() =>
                            run(
                                { do: 'advance' },
                                `Langkah ${stepLabels[next]} dibuka.`,
                                next === stepOrder.at(-1) ? 'card' : undefined,
                            )
                        }
                    >
                        Buka langkah berikutnya: {stepLabels[next]}
                    </Button>
                )}
                <Button
                    variant="outline"
                    aria-disabled={pending}
                    className={busy}
                    onClick={() =>
                        run(
                            { do: 'extend', minutes: 5 },
                            live.endsAt
                                ? 'Waktu ditambah 5 menit.'
                                : 'Batas waktu 5 menit dipasang.',
                        )
                    }
                >
                    {live.endsAt ? 'Tambah 5 menit' : 'Beri batas 5 menit'}
                </Button>
                <Button
                    variant="outline"
                    aria-disabled={pending}
                    className={busy}
                    onClick={onEnd}
                >
                    Akhiri sesi
                </Button>
            </div>
            {stale && (
                <Alert tone="attention">
                    Keadaan terbaru belum bisa dimuat. Halaman ini mencoba lagi
                    sendiri.
                </Alert>
            )}
            <section aria-labelledby="live-requests-title">
                <h3
                    id="live-requests-title"
                    ref={requestsHeading}
                    tabIndex={-1}
                    className={`py-1 font-semibold ${focusHeading}`}
                >
                    Minta bantuan
                </h3>
                {monitor.requests.length === 0 ? (
                    <p className="text-muted-foreground">
                        Belum ada yang meminta bantuan.
                    </p>
                ) : (
                    <ul className="divide-paper-edge divide-y">
                        {monitor.requests.map((request) => (
                            <li
                                key={request.id}
                                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2"
                            >
                                <span className="min-w-0 break-words">
                                    <span className="font-medium">
                                        {request.name}
                                    </span>
                                    {request.step &&
                                        ` · ${stepLabels[request.step]}`}
                                </span>
                                <Button
                                    variant="outline"
                                    aria-disabled={pending}
                                    aria-label={`Sudah dibantu: ${request.name}`}
                                    className={busy}
                                    onClick={() =>
                                        run(
                                            {
                                                do: 'helped',
                                                helpId: request.id,
                                            },
                                            `${request.name} sudah dibantu.`,
                                            'requests',
                                        )
                                    }
                                >
                                    Sudah dibantu
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <section aria-labelledby="live-students-title">
                <h3 id="live-students-title" className="py-1 font-semibold">
                    Siswa
                </h3>
                {monitor.students.length === 0 ? (
                    <p className="text-muted-foreground">
                        Belum ada siswa di kelas ini.
                    </p>
                ) : (
                    <ul className="divide-paper-edge divide-y">
                        {monitor.students.map((student) => (
                            <li
                                key={student.id}
                                className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2"
                            >
                                <span className="min-w-0 font-medium break-words">
                                    {student.name}
                                </span>
                                <span>
                                    {stateLabels[student.state]}
                                    {student.step &&
                                        ` · ${stepLabels[student.step]}`}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}

export function LiveCard({
    classId,
    assignmentId,
}: {
    classId: number;
    assignmentId: number;
}) {
    const monitor = useQuery(liveMonitorQuery(classId, assignmentId));
    const action = useLiveAction(classId, assignmentId);
    const [ending, setEnding] = useState(false);
    const [message, setMessage] = useState({ text: '', count: 0 });
    const heading = useRef<HTMLHeadingElement>(null);
    const requestsHeading = useRef<HTMLHeadingElement>(null);
    const known = useRef<Set<number> | null>(null);
    const ended = useRef(false);
    const announce = useCallback(
        (text: string) =>
            setMessage((previous) => ({ text, count: previous.count + 1 })),
        [],
    );
    const { data } = monitor;
    const requests = data?.requests;
    const live = data?.live && running(data.live) ? data.live : null;
    const conflict = liveConflict(action.error);

    useEffect(() => {
        if (!requests) return;
        const seen = known.current;
        known.current = new Set(requests.map(({ id }) => id));
        if (!seen) return;
        const fresh = requests.filter(({ id }) => !seen.has(id));
        if (fresh.length > 0) {
            announce(
                fresh.map(({ name }) => `${name} meminta bantuan.`).join(' '),
            );
        }
    }, [requests, announce]);

    const run: Run = (next, announcement, focus) => {
        if (action.isPending) return;
        action.mutate(next, {
            onSuccess: () => {
                announce(announcement);
                if (focus === 'card') heading.current?.focus();
                if (focus === 'requests') requestsHeading.current?.focus();
            },
            onError: (error) => {
                if (liveConflict(error)) heading.current?.focus();
            },
        });
    };
    const leaveDialog = () => {
        ended.current = true;
        setEnding(false);
    };
    const end = () => {
        if (action.isPending) return;
        action.mutate(
            { do: 'end' },
            {
                onSuccess: () => {
                    announce('Sesi langsung selesai.');
                    leaveDialog();
                },
                onError: (error) => {
                    if (liveConflict(error)) leaveDialog();
                },
            },
        );
    };
    const closeEnd = (dialog?: HTMLDialogElement) => {
        if (action.isPending) {
            if (dialog && !dialog.open) dialog.showModal();
            return;
        }
        setEnding(false);
        if (ended.current) {
            ended.current = false;
            heading.current?.focus();
        }
    };

    return (
        <Card>
            <section aria-labelledby="live-title" className="space-y-4">
                <h2
                    id="live-title"
                    ref={heading}
                    tabIndex={-1}
                    className={`text-lg font-semibold ${focusHeading}`}
                >
                    Sesi langsung
                </h2>
                {conflict ? (
                    <Alert tone="attention" role="alert">
                        Sesi sudah berubah. Halaman ini memuat ulang keadaannya.
                    </Alert>
                ) : (
                    !ending && <RequestError error={action.error} />
                )}
                {data ? (
                    live ? (
                        <LivePanel
                            live={live}
                            monitor={data}
                            stale={monitor.isError}
                            pending={action.isPending}
                            run={run}
                            onEnd={() => {
                                if (action.isPending) return;
                                action.reset();
                                setEnding(true);
                            }}
                            requestsHeading={requestsHeading}
                        />
                    ) : (
                        <StartForm
                            lastEnded={data.live !== null}
                            error={action.error}
                            pending={action.isPending}
                            run={run}
                        />
                    )
                ) : monitor.isPending ? (
                    <p role="status">Memuat sesi langsung…</p>
                ) : (
                    <div className="space-y-3">
                        <RequestError error={monitor.error} />
                        <Button
                            onClick={() => {
                                void monitor.refetch();
                            }}
                        >
                            Muat ulang sesi langsung
                        </Button>
                    </div>
                )}
            </section>
            <p role="status" className="sr-only">
                <span key={message.count}>{message.text}</span>
            </p>
            <Dialog
                open={ending}
                onClose={closeEnd}
                onCancel={(event) => {
                    if (action.isPending) event.preventDefault();
                }}
                aria-labelledby="live-end-title"
                aria-describedby="live-end-note"
            >
                <h2
                    id="live-end-title"
                    className="text-primary-deep text-xl font-bold"
                >
                    Akhiri sesi langsung?
                </h2>
                <p
                    id="live-end-note"
                    className="text-muted-foreground mt-2 leading-relaxed"
                >
                    Siswa yang belum selesai masih bisa melanjutkan sendiri.
                </p>
                <div className="mt-5 space-y-4">
                    {ending && !conflict && (
                        <RequestError error={action.error} />
                    )}
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="outline"
                            autoFocus
                            disabled={action.isPending}
                            onClick={() => closeEnd()}
                        >
                            Batal
                        </Button>
                        <Button
                            aria-disabled={action.isPending}
                            className={busy}
                            onClick={end}
                        >
                            {action.isPending ? 'Mengakhiri…' : 'Akhiri sesi'}
                        </Button>
                    </div>
                </div>
            </Dialog>
        </Card>
    );
}
