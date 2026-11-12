import type { Queryable } from '../db/index.ts';
import { competencies, modules } from '../db/schema.ts';
import type { CompetencyDraft } from '../studio/competencies.ts';

export async function storeModule(
    tx: Queryable,
    chapter: {
        materialId: number;
        version: number;
        title: string;
        firstPage: number;
        lastPage: number;
        madeBy: 'teacher' | 'ai';
        competencies: CompetencyDraft[];
    },
) {
    const [module] = await tx
        .insert(modules)
        .values({
            materialId: chapter.materialId,
            title: chapter.title,
            firstPage: chapter.firstPage,
            lastPage: chapter.lastPage,
            materialVersion: chapter.version,
            madeBy: chapter.madeBy,
        })
        .returning({
            id: modules.id,
            title: modules.title,
            firstPage: modules.firstPage,
            lastPage: modules.lastPage,
        });
    const stored = await tx
        .insert(competencies)
        .values(
            chapter.competencies.map((item) => ({
                moduleId: module.id,
                code: item.code,
                description: item.description,
                pages: [...new Set(item.pages)].sort((a, b) => a - b),
                rubric: item.rubric,
            })),
        )
        .returning({
            id: competencies.id,
            code: competencies.code,
            description: competencies.description,
            pages: competencies.pages,
        });

    return { ...module, competencies: stored };
}
