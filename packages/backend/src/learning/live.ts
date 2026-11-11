import { eq } from 'drizzle-orm';
import type { Queryable } from '../db/index.ts';
import { liveSessions } from '../db/schema.ts';
import { steps } from './blocks.ts';

export type Step = (typeof steps)[number];

export const stepIndex = (step: Step) => steps.indexOf(step);

export async function liveOf(db: Queryable, assignmentId: number) {
    const [row] = await db
        .select()
        .from(liveSessions)
        .where(eq(liveSessions.assignmentId, assignmentId));

    if (!row) return null;

    return row.state === 'open' && row.endsAt && row.endsAt <= new Date()
        ? { ...row, state: 'ended' as const }
        : row;
}
