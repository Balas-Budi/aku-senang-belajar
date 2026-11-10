import { interests, type Interest } from '../profile/interests';
import type { Step } from '../learning-sessions/queries';
import type { StudioBlock } from './queries';

export const kindLabels: Record<StudioBlock['kind'], string> = {
    brain_game: 'Permainan memori',
    hook: 'Pertanyaan pembuka',
    story: 'Cerita',
    check: 'Soal cek',
    challenge: 'Tantangan',
    reflection: 'Refleksi',
};

export const stepOfKind: Record<StudioBlock['kind'], Step> = {
    brain_game: 'opening',
    hook: 'opening',
    story: 'story',
    check: 'story',
    challenge: 'challenge',
    reflection: 'reflection',
};

export const failures: Record<string, string> = {
    invalid_output: 'Jawaban AI belum memenuhi aturan sesi.',
    timeout: 'AI terlalu lama menjawab.',
    network: 'AI belum bisa dihubungi.',
    http: 'AI belum bisa dihubungi.',
    interrupted: 'Server dimulai ulang saat AI sedang bekerja.',
    not_configured: 'AI belum diatur di server ini.',
};

export function joined(items: (string | number)[]) {
    if (items.length < 2) return items.join('');
    return `${items.slice(0, -1).join(', ')} dan ${items.at(-1)}`;
}

export const themeLabel = (key: Interest) =>
    interests.find((interest) => interest.key === key)?.label ?? key;

export const themeLabels = (keys: Interest[]) => joined(keys.map(themeLabel));

export const choiceCard =
    'border-border has-[:checked]:border-primary has-[:checked]:bg-secondary flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3';
export const choiceBox =
    'accent-primary focus-visible:outline-ring mt-0.5 size-5 shrink-0 focus-visible:outline-3 focus-visible:outline-offset-2';
export const focusHeading =
    'focus-visible:outline-ring rounded focus-visible:outline-3 focus-visible:outline-offset-4';
