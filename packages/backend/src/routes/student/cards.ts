import { and, eq, inArray } from 'drizzle-orm';
import type { Queryable } from '../../db/index.ts';
import { assignments, sessionBlocks } from '../../db/schema.ts';
import { sessionBlock } from '../../learning/blocks.ts';
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
                      content: sessionBlocks.content,
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
                  .where(
                      inArray(
                          assignments.id,
                          done.map(({ stage }) => stage.id),
                      ),
                  );

    return {
        cards: done.flatMap(({ subject, chapter, stage }) => {
            const block = sessionBlock.safeParse({
                kind: 'reflection',
                content: reflections.find(
                    ({ assignmentId }) => assignmentId === stage.id,
                )?.content,
            });

            return block.success && block.data.kind === 'reflection'
                ? [
                      {
                          id: stage.id,
                          title: stage.title,
                          chapter: chapter.title,
                          subject,
                          takeaways: block.data.content.takeaways,
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
