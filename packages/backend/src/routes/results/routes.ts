import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import { classParams } from '../classes/schema.ts';
import {
    analyseAgain,
    listAssignments,
    sessionResults,
    studentEvidence,
    verify,
} from './handlers.ts';
import {
    assessmentParams,
    assignmentParams,
    assignmentsResponse,
    attemptParams,
    evidenceResponse,
    resultsResponse,
    studentParams,
    verificationBody,
    verificationResponse,
} from './schema.ts';

export const resultRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.addHook('preHandler', requireRole('teacher'));

    fastify.get(
        '/classes/:classId/assignments',
        {
            schema: {
                params: classParams,
                response: { 200: assignmentsResponse },
            },
        },
        listAssignments,
    );
    fastify.get(
        '/classes/:classId/assignments/:assignmentId/results',
        {
            schema: {
                params: assignmentParams,
                response: { 200: resultsResponse },
            },
        },
        sessionResults,
    );
    fastify.get(
        '/classes/:classId/assignments/:assignmentId/students/:studentId',
        {
            schema: {
                params: studentParams,
                response: { 200: evidenceResponse },
            },
        },
        studentEvidence,
    );
    fastify.post(
        '/assessments/:assessmentId/verifications',
        {
            schema: {
                params: assessmentParams,
                body: verificationBody,
                response: { 201: verificationResponse },
            },
        },
        verify,
    );
    fastify.post(
        '/attempts/:attemptId/analysis',
        { schema: { params: attemptParams } },
        analyseAgain,
    );
};
