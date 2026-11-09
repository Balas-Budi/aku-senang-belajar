import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Subject } from '../assignments/queries';
import type {
    Competency,
    Decision,
    RunStatus,
    Shown,
    UnderstandingStatus,
} from '../results/queries';

export type Report = {
    id: number;
    draft: string | null;
    text: string | null;
    drafting: 'generating' | 'failed' | null;
    draftedAt: string | null;
    checkedAt: string | null;
    outdated: boolean;
} | null;

export type Counts = {
    competencyId: number;
    visible: number;
    developing: number;
    needsVerification: number;
    notObserved: number;
    withEvidence: number;
};

export type ChapterReport = {
    chapter: { id: number; title: string; subject: Subject };
    missions: {
        id: number;
        title: string;
        submittedCount: number;
        analysedCount: number;
    }[];
    competencies: Competency[];
    studentCount: number;
    students: {
        id: number;
        name: string;
        finished: number;
        competencies: (Shown & {
            competencyId: number;
            assessmentId: number;
            assignmentId: number;
        })[];
    }[];
    counts: Counts[];
    summaryCount: number;
    report: Report;
};

export type MissionHistory = {
    assignmentId: number;
    title: string;
    chapter: string;
    submittedAt: string | null;
    analysis: RunStatus | null;
    summary: { id: number; text: string; excluded: boolean } | null;
    competencies: (Competency & {
        assessmentId: number;
        estimate: UnderstandingStatus;
        shown: Shown;
    })[];
};

export type StudentReport = {
    student: { id: number; name: string };
    missions: MissionHistory[];
    summaryCount: number;
    report: Report;
    reviews: {
        blockId: number;
        mission: string;
        prompt: string;
        rounds: {
            tries: number;
            result: 'correct' | 'revealed' | 'open';
            at: string;
        }[];
    }[];
};

const headers = (cookie?: string | null) => (cookie ? { cookie } : undefined);

const generating = (report: Report | undefined) =>
    report?.drafting === 'generating' ? 3_000 : false;

export const chapterReportQuery = (
    classId: number,
    moduleId: number,
    cookie?: string | null,
) =>
    queryOptions({
        queryKey: ['classes', classId, 'reports', 'chapters', moduleId],
        queryFn: () =>
            api<ChapterReport>(
                `/api/classes/${classId}/chapters/${moduleId}/report`,
                { headers: headers(cookie) },
            ),
        refetchInterval: (query) => generating(query.state.data?.report),
    });

export const studentReportQuery = (
    classId: number,
    studentId: number,
    cookie?: string | null,
) =>
    queryOptions({
        queryKey: ['classes', classId, 'reports', 'students', studentId],
        queryFn: () =>
            api<StudentReport>(
                `/api/classes/${classId}/students/${studentId}/report`,
                { headers: headers(cookie) },
            ),
        refetchInterval: (query) => generating(query.state.data?.report),
    });

export function useReportActions(classId: number, reportUrl: string) {
    const client = useQueryClient();
    const refresh = () =>
        client.invalidateQueries({
            queryKey: ['classes', classId, 'reports'],
        });
    const draft = useMutation({
        mutationFn: () =>
            api<{ drafting: 'generating' }>(`${reportUrl}/draft`, {
                method: 'POST',
            }),
        onSettled: refresh,
    });
    const check = useMutation({
        mutationFn: ({ reportId, text }: { reportId: number; text: string }) =>
            api<{ id: number; text: string; checkedAt: string }>(
                `/api/reports/${reportId}`,
                { method: 'PUT', body: JSON.stringify({ text }) },
            ),
        onSuccess: refresh,
    });

    return { draft, check };
}

export function useExcludeSummary(classId: number) {
    const client = useQueryClient();

    return useMutation({
        mutationFn: ({
            summaryId,
            excluded,
        }: {
            summaryId: number;
            excluded: boolean;
        }) =>
            api<{ id: number; excluded: boolean }>(
                `/api/learner-summaries/${summaryId}/excluded`,
                { method: 'PUT', body: JSON.stringify({ excluded }) },
            ),
        onSuccess: () =>
            client.invalidateQueries({ queryKey: ['classes', classId] }),
    });
}
