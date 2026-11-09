export type Speaking = {
    owner: string | null;
    index: number;
    status: 'idle' | 'playing' | 'paused';
};

const idle: Speaking = { owner: null, index: 0, status: 'idle' };
const listeners = new Set<() => void>();
let current = idle;
let run = 0;

function set(next: Speaking) {
    current = next;
    listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export const speaking = () => current;
export const notSpeaking = () => idle;

export function sentencesOf(text: string) {
    return text
        .trim()
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean);
}

export function indonesianVoice() {
    return (
        speechSynthesis
            .getVoices()
            .filter((voice) => /^(id|in)([-_]|$)/i.test(voice.lang))
            .sort(
                (one, other) =>
                    Number(other.localService) - Number(one.localService),
            )[0] ?? null
    );
}

export function speak(
    owner: string,
    sentences: string[],
    start: number,
    rate: number,
    voice: SpeechSynthesisVoice,
) {
    const mine = ++run;
    speechSynthesis.cancel();
    const say = (index: number) => {
        if (mine !== run) return;
        if (index >= sentences.length) return set(idle);
        const utterance = new SpeechSynthesisUtterance(sentences[index]);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = rate;
        utterance.onend = () => say(index + 1);
        utterance.onerror = () => {
            if (mine === run) set(idle);
        };
        set({ owner, index, status: 'playing' });
        speechSynthesis.speak(utterance);
    };
    say(start);
}

export function pause() {
    if (current.status !== 'playing') return;
    run++;
    speechSynthesis.cancel();
    set({ ...current, status: 'paused' });
}

export function stop(owner: string) {
    if (current.owner !== owner) return;
    run++;
    speechSynthesis.cancel();
    set(idle);
}
