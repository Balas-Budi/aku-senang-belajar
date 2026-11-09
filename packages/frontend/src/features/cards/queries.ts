import { queryOptions } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Subject } from '../assignments/queries';

export type KnowledgeCards = {
    cards: {
        id: number;
        title: string;
        chapter: string;
        subject: Subject;
        takeaways: string[];
    }[];
    stickers: { id: number; title: string; book: string; subject: Subject }[];
};

export const studentCardsQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: ['student', 'cards'],
        queryFn: () =>
            api<KnowledgeCards>('/api/student/cards', {
                headers: cookie ? { cookie } : undefined,
            }),
    });
