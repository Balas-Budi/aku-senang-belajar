import type { Step } from './queries';

export const stepOrder: Step[] = [
    'opening',
    'story',
    'challenge',
    'reflection',
];

export const stepLabels: Record<Step, string> = {
    opening: 'Pembuka',
    story: 'Cerita',
    challenge: 'Tantangan',
    reflection: 'Refleksi',
};
