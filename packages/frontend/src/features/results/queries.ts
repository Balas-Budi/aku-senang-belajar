import {
    queryOptions,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Subject } from '../assignments/queries';
import type { IllustrationName } from '../learning-sessions/illustration';

export type UnderstandingStatus =
    'not_observed' | 'developing' | 'visible' | 'needs_verification';
export type Decision = 'agree' | 'change' | 'unsure';
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type Progress = 'not_started' | 'in_progress' | 'submitted';
export type Shown = { status: UnderstandingStatus; decision: Decision | null };

export type Mission = {
    id: number;
    title: string;
    subject: Subject;
    moduleTitle: string;
};

export type ClassMission = Mission & {
    assignedAt: string;
    studentCount: number;
    submittedCount: number;
    analysedCount: number;
};

export type Competency = { id: number; code: string; description: string };

export type StudentResult = {
    id: number;
    name: string;
    progress: Progress;
    attemptId: number | null;
    analysis: RunStatus | null;
    competencies: (Shown & { competencyId: number; assessmentId: number })[];
};

export type SessionResults = {
    assignment: Mission;
    competencies: Competency[];
    students: StudentResult[];
};

export type EvidenceQuestion = {
    block: number;
    kind: 'check' | 'challenge';
    question: string;
    picture?: IllustrationName;
    diagram?: string;
    options: { id: string; label: string; picture?: IllustrationName }[];
    rightOption: string;
    tries: {
        ref: number;
        try: number;
        choice: string;
        reason?: string;
        outcome: 'accepted' | 'correct' | 'not_yet';
    }[];
    help: {
        hints: number;
        otherExample: boolean;
        answerShown: boolean;
        askedTeacher: boolean;
        diagrams?: string[];
    };
};

export type SelfReport = {
    ref: number;
    understood: string[];
    confusing: string[];
    note?: string;
};

export type Verification = {
    id: number;
    decision: Decision;
    status: UnderstandingStatus;
    note: string | null;
    createdAt: string;
};

export type Assessment = {
    id: number;
    status: UnderstandingStatus;
    reason: string;
    uncertainty: 'low' | 'medium' | 'high';
    flags: ('thin' | 'ambiguous' | 'conflicting')[];
    evidence: number[];
    followUps: string[];
    shown: Shown;
    verifications: Verification[];
};

export type CompetencyEvidence = Competency & {
    rubric: {
        visible: string[];
        developing: string[];
        notEnough: string[];
    } | null;
    questions: EvidenceQuestion[];
    selfReport: SelfReport | null;
    assessment: Assessment | null;
};

export type StudentEvidence = {
    student: { id: number; name: string };
    assignment: Mission;
    progress: Progress;
    attemptId: number | null;
    analysis: RunStatus | null;
    summary: { id: number; text: string; excluded: boolean } | null;
    competencies: CompetencyEvidence[];
};

export type VerificationInput =
    | { decision: 'agree' | 'unsure'; note: string }
    | {
          decision: 'change';
          status: Exclude<UnderstandingStatus, 'needs_verification'>;
          note: string;
      };

const headers = (cookie?: string | null) => (cookie ? { cookie } : undefined);

const overviewKey = ['teacher', 'overview'];

export const analysing = (analysis: RunStatus | null) =>
    analysis === 'queued' || analysis === 'running';

export const classMissionsQuery = (classId: number, cookie?: string | null) =>
    queryOptions({
        queryKey: ['classes', classId, 'assignments'],
        queryFn: () =>
            api<ClassMission[]>(`/api/classes/${classId}/assignments`, {
                headers: headers(cookie),
            }),
    });

export const sessionResultsQuery = (
    classId: number,
    assignmentId: number,
    cookie?: string | null,
) =>
    queryOptions({
        queryKey: ['classes', classId, 'assignments', assignmentId, 'results'],
        queryFn: () =>
            api<SessionResults>(
                `/api/classes/${classId}/assignments/${assignmentId}/results`,
                { headers: headers(cookie) },
            ),
        refetchInterval: (query) =>
            query.state.data?.students.some(({ analysis }) =>
                analysing(analysis),
            )
                ? 5_000
                : false,
    });

export const studentEvidenceQuery = (
    classId: number,
    assignmentId: number,
    studentId: number,
    cookie?: string | null,
) =>
    queryOptions({
        queryKey: [
            'classes',
            classId,
            'assignments',
            assignmentId,
            'students',
            studentId,
        ],
        queryFn: () =>
            api<StudentEvidence>(
                `/api/classes/${classId}/assignments/${assignmentId}/students/${studentId}`,
                { headers: headers(cookie) },
            ),
        refetchInterval: (query) =>
            analysing(query.state.data?.analysis ?? null) ? 5_000 : false,
    });

export function useVerify(classId: number, assignmentId: number) {
    const client = useQueryClient();

    return useMutation({
        mutationFn: ({
            assessmentId,
            ...input
        }: VerificationInput & { assessmentId: number }) =>
            api<Verification>(
                `/api/assessments/${assessmentId}/verifications`,
                { method: 'POST', body: JSON.stringify(input) },
            ),
        onSuccess: () =>
            Promise.all([
                client.invalidateQueries({
                    queryKey: ['classes', classId, 'assignments', assignmentId],
                }),
                client.invalidateQueries({ queryKey: overviewKey }),
            ]),
    });
}

export function useAnalyseAgain(classId: number) {
    const client = useQueryClient();

    return useMutation({
        mutationFn: (attemptId: number) =>
            api<{ analysis: 'queued' }>(`/api/attempts/${attemptId}/analysis`, {
                method: 'POST',
            }),
        onSettled: () =>
            Promise.all([
                client.invalidateQueries({
                    queryKey: ['classes', classId, 'assignments'],
                }),
                client.invalidateQueries({ queryKey: overviewKey }),
            ]),
    });
}

export type TeacherOverview = {
    needsVerification: number;
    unreviewed: number;
    waiting: number;
    missions: {
        classId: number;
        className: string;
        assignmentId: number;
        title: string;
        students: number;
        submitted: number;
        needsVerification: number;
        unreviewed: number;
        waiting: number;
    }[];
    checks: {
        classId: number;
        className: string;
        assignmentId: number;
        missionTitle: string;
        studentId: number;
        studentName: string;
        competencyCode: string;
        decision: Decision | null;
    }[];
};

export const teacherOverviewQuery = (cookie?: string | null) =>
    queryOptions({
        queryKey: overviewKey,
        queryFn: () =>
            api<TeacherOverview>('/api/teacher/overview', {
                headers: headers(cookie),
            }),
    });
