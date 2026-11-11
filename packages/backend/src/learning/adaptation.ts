import { z } from 'zod';
import {
    adaptationHelp,
    adaptationLead,
    adaptationSource,
    type Adaptation,
} from '../db/schema.ts';

export const adaptationPair = z.object({
    helpFirst: z.enum(adaptationHelp.enumValues).nullable(),
    lead: z.enum(adaptationLead.enumValues).nullable(),
});

type AdaptationRow = {
    off: boolean;
    source: (typeof adaptationSource.enumValues)[number];
    helpFirst: Adaptation['helpFirst'];
    lead: Adaptation['lead'];
    aiHelpFirst: Adaptation['helpFirst'];
    aiLead: Adaptation['lead'];
};

export function followedPair(
    row: AdaptationRow | undefined,
): Adaptation | null {
    if (!row || row.off) return null;
    const pair =
        row.source === 'teacher'
            ? { helpFirst: row.helpFirst, lead: row.lead }
            : { helpFirst: row.aiHelpFirst, lead: row.aiLead };
    return pair.helpFirst === null && pair.lead === null ? null : pair;
}

const helpText = { example: 'example first', hint: 'hint first' } as const;
const leadText = {
    text: 'text first',
    audio: 'read aloud',
    visual: 'picture first',
} as const;

export function putFirstText(pair: Adaptation | null): string {
    const parts = [
        pair?.helpFirst ? helpText[pair.helpFirst] : null,
        pair?.lead ? leadText[pair.lead] : null,
    ].filter((part) => part !== null);
    return parts.length > 0 ? parts.join(', ') : 'nothing';
}
