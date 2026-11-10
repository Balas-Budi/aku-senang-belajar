import { and, eq, inArray } from 'drizzle-orm';
import type { Queryable } from '../../db/index.ts';
import { assignments, attempts, sessionBlocks } from '../../db/schema.ts';
import { sessionBlock } from '../../learning/blocks.ts';
import { themedOr, themesFor } from '../../learning/themed-blocks.ts';
import { pathOf } from './path.ts';

export async function cardsOf(db: Queryable, studentId: number) {
    const { subjects } = await pathOf(db, studentId);
    const done = subjects.flatMap(({ subject, chapters }) =>
        chapters.flatMap((chapter) =>
            chapter.stages
                .filter(({ progress }) => progress === 'submitted')
                .map((stage) => ({ subject, chapter, stage })),
        ),
    );
    const reflections =
        done.length === 0
            ? []
            : await db
                  .select({
                      assignmentId: assignments.id,
                      id: sessionBlocks.id,
                      content: sessionBlocks.content,
                      theme: attempts.theme,
                  })
                  .from(assignments)
                  .innerJoin(
                      sessionBlocks,
                      and(
                          eq(
                              sessionBlocks.learningSessionId,
                              assignments.learningSessionId,
                          ),
                          eq(sessionBlocks.kind, 'reflection'),
                      ),
                  )
                  .innerJoin(
                      attempts,
                      and(
                          eq(attempts.assignmentId, assignments.id),
                          eq(attempts.studentId, studentId),
                      ),
                  )
                  .where(
                      inArray(
                          assignments.id,
                          done.map(({ stage }) => stage.id),
                      ),
                  );
    const themes = await themesFor(
        db,
        reflections.map(({ id, theme }) => ({ blockId: id, theme })),
    );

    return {
        cards: done.flatMap(({ subject, chapter, stage }) => {
            const row = reflections.find(
                ({ assignmentId }) => assignmentId === stage.id,
            );
            const base = sessionBlock.safeParse({
                kind: 'reflection',
                content: row?.content,
            });
            const block =
                row && base.success
                    ? themedOr(base.data, themes.get(row.id))
                    : null;

            return block?.kind === 'reflection'
                ? [
                      {
                          id: stage.id,
                          title: stage.title,
                          chapter: chapter.title,
                          subject,
                          takeaways: block.content.takeaways,
                      },
                  ]
                : [];
        }),
        stickers: subjects.flatMap(({ subject, chapters }) =>
            chapters
                .filter(
                    ({ open, stages }) =>
                        open &&
                        stages.every(
                            ({ progress }) => progress === 'submitted',
                        ),
                )
                .map(({ id, title, book }) => ({ id, title, book, subject })),
        ),
    };
}
