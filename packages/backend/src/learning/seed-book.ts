import { and, eq, isNull } from 'drizzle-orm';
import type { Queryable } from '../db/index.ts';
import { materials } from '../db/schema.ts';
import {
    insertChapter,
    insertSession,
    parseBlocks,
    parseCompetencies,
    type PreparedModule,
} from './seed-module.ts';

export type PreparedBook = {
    subject: PreparedModule['subject'];
    material: string;
    grade: number;
    chapters: {
        title: string;
        competencies: PreparedModule['competencies'];
        sessions: (PreparedModule['session'] & {
            blocks: PreparedModule['blocks'];
        })[];
    }[];
};

export async function seedBook(db: Queryable, book: PreparedBook) {
    const chapters = book.chapters.map((chapter) => ({
        ...chapter,
        parsed: parseCompetencies(chapter.competencies),
        sessions: chapter.sessions.map(({ blocks, ...session }) => ({
            session,
            blocks: parseBlocks(blocks),
        })),
    }));

    return db.transaction(async (tx) => {
        const [existing] = await tx
            .select({ id: materials.id })
            .from(materials)
            .where(
                and(
                    eq(materials.title, book.material),
                    isNull(materials.ownerId),
                ),
            );

        if (existing) return { created: false };

        const [material] = await tx
            .insert(materials)
            .values({
                subject: book.subject,
                title: book.material,
                grade: book.grade,
            })
            .returning({ id: materials.id });

        for (const chapter of chapters) {
            const { moduleId, competencyIds } = await insertChapter(
                tx,
                { materialId: material.id, title: chapter.title },
                chapter.parsed,
            );

            for (const { session, blocks } of chapter.sessions) {
                await insertSession(
                    tx,
                    moduleId,
                    competencyIds,
                    session,
                    blocks,
                );
            }
        }

        return { created: true };
    });
}
