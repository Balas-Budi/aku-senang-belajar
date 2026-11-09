import { queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Subject } from '../assignments/queries';
import type { Step } from '../learning-sessions/queries';

export type Stage = {
    id: number;
    title: string;
    summary: string;
    progress: 'not_started' | 'in_progress' | 'submitted';
    step: Step | null;
    locked: boolean;
};
export type Chapter = {
    id: number;
    title: string;
    book: string;
    open: boolean;
    stages: Stage[];
};
export type LearningPath = {
    subjects: { subject: Subject; chapters: Chapter[] }[];
};

export const studentPathQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'path'],
        queryFn: () =>
            api<LearningPath>('/api/student/path', {
                headers: cookie ? { cookie } : undefined,
            }),
    });

export function chaptersOf(path: LearningPath, subject: Subject) {
    return path.subjects.find((entry) => entry.subject === subject)?.chapters;
}

export function findChapter(path: LearningPath, chapterId: number) {
    for (const { subject, chapters } of path.subjects) {
        const chapter = chapters.find(({ id }) => id === chapterId);
        if (chapter) {
            const sameBook = chapters.filter(
                ({ book }) => book === chapter.book,
            );
            return { subject, chapter, number: sameBook.indexOf(chapter) + 1 };
        }
    }
    return null;
}

export const finished = (stages: Stage[]) =>
    stages.filter(({ progress }) => progress === 'submitted').length;

export function subjectStages(path: LearningPath, chapterId: number) {
    return (
        path.subjects
            .find(({ chapters }) => chapters.some(({ id }) => id === chapterId))
            ?.chapters.flatMap(({ stages }) => stages) ?? []
    );
}

export function visibleChapters(chapters: Chapter[]) {
    const lastOpen = chapters.reduce(
        (last, chapter, index) => (chapter.open ? index : last),
        -1,
    );
    return chapters.slice(0, lastOpen + 2);
}

export function currentStage(chapters: Chapter[]) {
    const stages = chapters.flatMap((chapter) =>
        chapter.stages.map((stage) => ({ chapter, stage })),
    );
    return (
        stages.find(({ stage }) => stage.progress === 'in_progress') ??
        stages.find(
            ({ stage }) => stage.progress !== 'submitted' && !stage.locked,
        ) ??
        null
    );
}
