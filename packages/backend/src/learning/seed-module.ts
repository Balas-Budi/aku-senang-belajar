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
import { competencyRubric, type CompetencyRubric } from './rubric.ts';

export type PreparedModule = {
    subject: typeof materials.$inferInsert.subject;
    material: string;
    module: string;
    competencies: {
        code: string;
        description: string;
        rubric?: CompetencyRubric;
    }[];
    session: { title: string; summary: string };
    blocks: (SessionBlock & { competencies: string[] })[];
};

type ParsedCompetency = {
    code: string;
    description: string;
    rubric: CompetencyRubric | null;
};

type ParsedBlock = { block: SessionBlock; codes: string[] };

async function insertModule(
    tx: Queryable,
    prepared: PreparedModule,
    parsed: ParsedCompetency[],
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
            parsed.map((competency) => ({
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

async function refreshRubrics(
    tx: Queryable,
    moduleId: number,
    parsed: ParsedCompetency[],
) {
    for (const { code, rubric } of parsed) {
        await tx
            .update(competencies)
            .set({ rubric })
            .where(
                and(
                    eq(competencies.moduleId, moduleId),
                    eq(competencies.code, code),
                ),
            );
    }
}

export async function seedModule(
    db: Queryable,
    classId: number,
    prepared: PreparedModule,
) {
    const parsed = prepared.competencies.map(
        ({ code, description, rubric }) => ({
            code,
            description,
            rubric: rubric ? competencyRubric.parse(rubric) : null,
        }),
    );
    const blocks = prepared.blocks.map((block) => ({
        block: sessionBlock.parse(block),
        codes: block.competencies,
    }));

    return db.transaction(async (tx) => {
        const [existing] = await tx
            .select({
                id: learningSessions.id,
                moduleId: learningSessions.moduleId,
            })
            .from(learningSessions)
            .innerJoin(modules, eq(modules.id, learningSessions.moduleId))
            .innerJoin(materials, eq(materials.id, modules.materialId))
            .where(
                and(
                    eq(materials.title, prepared.material),
                    eq(learningSessions.title, prepared.session.title),
                ),
            );

        if (existing) {
            await refreshRubrics(tx, existing.moduleId, parsed);
        }

        const sessionId =
            existing?.id ?? (await insertModule(tx, prepared, parsed, blocks));
        const assigned = await tx
            .insert(assignments)
            .values({ learningSessionId: sessionId, classId })
            .onConflictDoNothing()
            .returning({ id: assignments.id });

        return { sessionId, assigned: assigned.length > 0 };
    });
}
