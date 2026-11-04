import { and, eq } from 'drizzle-orm';
import type { Queryable } from '../db/index.ts';
import {
    assignments,
    blockCompetencies,
    competencies,
    learningSessions,
    materials,
    modules,
    sessionBlocks,
} from '../db/schema.ts';
import { sessionBlock, type SessionBlock } from './blocks.ts';

export type PreparedModule = {
    subject: typeof materials.$inferInsert.subject;
    material: string;
    module: string;
    competencies: { code: string; description: string }[];
    session: { title: string; summary: string };
    blocks: (SessionBlock & { competencies: string[] })[];
};

type ParsedBlock = { block: SessionBlock; codes: string[] };

async function insertModule(
    tx: Queryable,
    prepared: PreparedModule,
    blocks: ParsedBlock[],
) {
    const [material] = await tx
        .insert(materials)
        .values({ subject: prepared.subject, title: prepared.material })
        .returning({ id: materials.id });
    const [chapter] = await tx
        .insert(modules)
        .values({ materialId: material.id, title: prepared.module })
        .returning({ id: modules.id });
    const stored = await tx
        .insert(competencies)
        .values(
            prepared.competencies.map((competency) => ({
                ...competency,
                moduleId: chapter.id,
            })),
        )
        .returning({ id: competencies.id, code: competencies.code });
    const competencyIds = new Map(stored.map(({ code, id }) => [code, id]));
    const [session] = await tx
        .insert(learningSessions)
        .values({ ...prepared.session, moduleId: chapter.id, status: 'ready' })
        .returning({ id: learningSessions.id });

    for (const [index, { block, codes }] of blocks.entries()) {
        const [row] = await tx
            .insert(sessionBlocks)
            .values({
                ...block,
                learningSessionId: session.id,
                position: index + 1,
            })
            .returning({ id: sessionBlocks.id });
        const links = codes.map((code) => {
            const competencyId = competencyIds.get(code);

            if (competencyId === undefined) {
                throw new Error(
                    `Block ${index + 1} names ${code}, which the module does not define`,
                );
            }

            return { blockId: row.id, competencyId };
        });

        if (links.length > 0) {
            await tx.insert(blockCompetencies).values(links);
        }
    }

    return session.id;
}

export async function seedModule(
    db: Queryable,
    classId: number,
    prepared: PreparedModule,
) {
    const blocks = prepared.blocks.map((block) => ({
        block: sessionBlock.parse(block),
        codes: block.competencies,
    }));

    return db.transaction(async (tx) => {
        const [existing] = await tx
            .select({ id: learningSessions.id })
            .from(learningSessions)
            .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
            .innerJoin(materials, eq(materials.id, modules.materialId))
            .where(
                and(
                    eq(materials.title, prepared.material),
                    eq(learningSessions.title, prepared.session.title),
                ),
            );
        const sessionId =
            existing?.id ?? (await insertModule(tx, prepared, blocks));
        const assigned = await tx
            .insert(assignments)
            .values({ learningSessionId: sessionId, classId })
            .onConflictDoNothing()
            .returning({ id: assignments.id });

        return { sessionId, assigned: assigned.length > 0 };
    });
}
