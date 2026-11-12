import { useEffect, useRef, useState } from 'react';
import { MicIcon } from '../../components/icons/mic-icon';
import { cn } from '../../lib/cn';
import { pause } from '../narration/speech';

type Recognition = EventTarget & {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
};

type RecognitionConstructor = new () => Recognition;

function recognitionConstructor() {
    const found: unknown =
        Reflect.get(window, 'SpeechRecognition') ??
        Reflect.get(window, 'webkitSpeechRecognition');
    return typeof found === 'function'
        ? (found as RecognitionConstructor)
        : null;
}

const problems: Partial<Record<SpeechRecognitionErrorCode, string>> = {
    'not-allowed':
        'Mikrofon belum diizinkan. Kamu tetap bisa mengetik jawabanmu.',
    'service-not-allowed':
        'Mikrofon belum diizinkan. Kamu tetap bisa mengetik jawabanmu.',
    'audio-capture': 'Mikrofon tidak ditemukan. Ketik jawabanmu saja, ya.',
    'no-speech': 'Suaramu belum terdengar. Coba lagi, atau ketik saja.',
    network: 'Sinyal sedang putus. Ketik jawabanmu saja, ya.',
    'language-not-supported':
        'Perangkat ini belum bisa mendengar Bahasa Indonesia. Ketik jawabanmu saja, ya.',
};

export function VoiceAnswer({
    fieldId,
    value,
    maxLength,
    onChange,
}: {
    fieldId: string;
    value: string;
    maxLength: number;
    onChange: (value: string) => void;
}) {
    const [Constructor, setConstructor] =
        useState<RecognitionConstructor | null>(null);
    const [listening, setListening] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const recognition = useRef<Recognition | null>(null);
    const latest = useRef(value);
    latest.current = value;

    useEffect(() => {
        setConstructor(() => recognitionConstructor());
        return () => recognition.current?.abort();
    }, []);

    if (!Constructor) return null;

    const start = () => {
        pause();
        const heard = new Constructor();
        heard.lang = 'id-ID';
        heard.interimResults = false;
        heard.continuous = false;
        heard.onresult = (event) => {
            const text = Array.from(event.results)
                .map((result) => result[0]?.transcript ?? '')
                .join(' ')
                .trim();
            if (!text) return;
            const before = latest.current.trimEnd();
            onChange((before ? `${before} ${text}` : text).slice(0, maxLength));
            setNote(
                'Periksa tulisannya. Kalau ada yang salah, perbaiki dulu sebelum mengirim.',
            );
            document.getElementById(fieldId)?.focus();
        };
        heard.onerror = (event) => {
            if (event.error !== 'aborted')
                setNote(
                    problems[event.error] ??
                        'Suaramu belum bisa diubah jadi tulisan. Ketik jawabanmu saja, ya.',
                );
        };
        heard.onend = () => {
            recognition.current = null;
            setListening(false);
        };
        recognition.current = heard;
        setNote(null);
        setListening(true);
        heard.start();
    };

    return (
        <div className="space-y-2">
            <button
                type="button"
                aria-pressed={listening}
                onClick={() =>
                    listening ? recognition.current?.stop() : start()
                }
                className={cn(
                    'focus-visible:outline-ring inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-4 font-semibold focus-visible:outline-3 focus-visible:outline-offset-2',
                    listening
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-primary-deep hover:bg-student-surface bg-white',
                )}
            >
                <MicIcon
                    className={cn(listening && 'motion-safe:animate-pulse')}
                />
                {listening ? 'Selesai bicara' : 'Jawab dengan suara'}
            </button>
            <p role="status" className="text-muted-foreground text-[0.9em]">
                {listening ? 'Aku mendengarkan. Bicaralah sekarang.' : note}
            </p>
        </div>
    );
}
