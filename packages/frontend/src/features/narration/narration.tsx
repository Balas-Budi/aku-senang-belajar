import {
    Fragment,
    useEffect,
    useMemo,
    useState,
    useSyncExternalStore,
} from 'react';
import { PauseIcon } from '../../components/icons/pause-icon';
import { PlayIcon } from '../../components/icons/play-icon';
import { ReplayIcon } from '../../components/icons/replay-icon';
import { SpeakerIcon } from '../../components/icons/speaker-icon';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { useLearningSettings } from '../settings/queries';
import {
    indonesianVoice,
    notSpeaking,
    pause,
    sentencesOf,
    speak,
    speaking,
    stop,
    subscribe,
} from './speech';

const separator = '\u0000';

export function useIndonesianVoice() {
    const [voice, setVoice] = useState<SpeechSynthesisVoice | null>();
    useEffect(() => {
        if (!('speechSynthesis' in window)) {
            setVoice(null);
            return;
        }
        const pick = () => {
            if (speechSynthesis.getVoices().length > 0)
                setVoice(indonesianVoice());
        };
        pick();
        speechSynthesis.addEventListener('voiceschanged', pick);
        const timer = setTimeout(
            () => setVoice((found) => found ?? null),
            2000,
        );
        return () => {
            speechSynthesis.removeEventListener('voiceschanged', pick);
            clearTimeout(timer);
        };
    }, []);
    return voice;
}

export function useNarration(id: string, parts: string[], auto = false) {
    const { readAloud, speechRate } = useLearningSettings();
    const voice = useIndonesianVoice();
    const now = useSyncExternalStore(subscribe, speaking, notSpeaking);
    const key = parts.join(separator);
    const sentences = useMemo(
        () =>
            key.split(separator).flatMap((part, index) =>
                sentencesOf(part).map((text, sentence) => ({
                    text,
                    part: index,
                    sentence,
                })),
            ),
        [key],
    );
    const mine = now.owner === id;
    const status = mine ? now.status : 'idle';
    const reading =
        mine && now.status === 'playing' ? sentences[now.index] : undefined;
    const from = (index: number) => {
        if (voice)
            speak(
                id,
                sentences.map(({ text }) => text),
                index,
                speechRate,
                voice,
            );
    };

    useEffect(() => {
        if (auto && readAloud && voice)
            speak(
                id,
                sentences.map(({ text }) => text),
                0,
                speechRate,
                voice,
            );
    }, [auto, readAloud, voice, id, sentences, speechRate]);
    useEffect(() => () => stop(id), [id]);

    return {
        voice,
        readAloud,
        status,
        sentenceIn: (part: number) =>
            reading?.part === part ? reading.sentence : null,
        play: () => from(mine && now.status === 'paused' ? now.index : 0),
        pause,
        replay: () => from(0),
    };
}

export type Narration = ReturnType<typeof useNarration>;

export function optionBeingRead(
    narration: Narration,
    options: { id: string }[],
    first: number,
) {
    return (
        options.find((_, index) => narration.sentenceIn(first + index) !== null)
            ?.id ?? null
    );
}

export function Spoken({
    text,
    sentence,
}: {
    text: string;
    sentence: number | null;
}) {
    return sentencesOf(text).map((part, index) => (
        <Fragment key={index}>
            {index > 0 && ' '}
            {index === sentence ? (
                <mark className="bg-student-accent-soft decoration-activity-orange rounded-md box-decoration-clone px-1 text-inherit underline decoration-2 underline-offset-4">
                    {part}
                </mark>
            ) : (
                part
            )}
        </Fragment>
    ));
}

const control = 'min-h-11 gap-1.5 rounded-full px-4 text-[0.85em]';

export function NarrationControls({
    narration,
    onListen,
    quiet = false,
    className,
}: {
    narration: Narration;
    onListen?: () => void;
    quiet?: boolean;
    className?: string;
}) {
    const { voice, status } = narration;
    const listening = (action: () => void) => () => {
        action();
        onListen?.();
    };

    if (voice === undefined)
        return quiet ? null : (
            <div aria-hidden="true" className={cn('min-h-11', className)} />
        );
    if (voice === null)
        return quiet || !narration.readAloud ? null : (
            <p className={cn('text-muted-foreground text-[0.8em]', className)}>
                Suara Bahasa Indonesia belum ada di perangkat ini.
            </p>
        );

    return (
        <div className={cn('flex flex-wrap gap-2', className)}>
            {status === 'playing' ? (
                <Button
                    variant="outline"
                    className={control}
                    onClick={narration.pause}
                >
                    <PauseIcon />
                    Jeda
                </Button>
            ) : (
                <Button
                    variant="outline"
                    className={control}
                    onClick={listening(narration.play)}
                >
                    {status === 'paused' ? <PlayIcon /> : <SpeakerIcon />}
                    {status === 'paused' ? 'Lanjutkan' : 'Dengarkan'}
                </Button>
            )}
            {status !== 'idle' && (
                <Button
                    variant="outline"
                    className={control}
                    onClick={listening(narration.replay)}
                >
                    <ReplayIcon />
                    Ulang
                </Button>
            )}
        </div>
    );
}
