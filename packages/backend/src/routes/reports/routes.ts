import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import { trackBackground } from '../../lib/background.ts';
import { chapterParams } from '../classes/schema.ts';
import {
    chapterCsv,
    chapterReport,
    checkReport,
    draftChapterReport,
    draftStudentReport,
    excludeSummary,
    setAdaptation,
    studentReport,
} from './handlers.ts';
import {
    adaptationBody,
    adaptationItem,
    adaptationParams,
    chapterReportResponse,
    checkBody,
    checkedResponse,
    classStudentParams,
    draftingResponse,
    excludedBody,
    excludedResponse,
    reportParams,
    studentReportResponse,
    summaryParams,
} from './schema.ts';

export const reportRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.addHook('preHandler', requireRole('teacher'));
    trackBackground(fastify);

    fastify.get(
        '/classes/:classId/chapters/:moduleId/report',
        {
            schema: {
                params: chapterParams,
                response: { 200: chapterReportResponse },
            },
        },
        chapterReport,
    );
    fastify.get(
        '/classes/:classId/chapters/:moduleId/report.csv',
        { schema: { params: chapterParams } },
        chapterCsv,
    );
    fastify.post(
        '/classes/:classId/chapters/:moduleId/report/draft',
        {
            schema: {
                params: chapterParams,
                response: { 202: draftingResponse },
            },
        },
        draftChapterReport,
    );
    fastify.get(
        '/classes/:classId/students/:studentId/report',
        {
            schema: {
                params: classStudentParams,
                response: { 200: studentReportResponse },
            },
        },
        studentReport,
    );
    fastify.post(
        '/classes/:classId/students/:studentId/report/draft',
        {
            schema: {
                params: classStudentParams,
                response: { 202: draftingResponse },
            },
        },
        draftStudentReport,
    );
    fastify.put(
        '/reports/:reportId',
        {
            schema: {
                params: reportParams,
                body: checkBody,
                response: { 200: checkedResponse },
            },
        },
        checkReport,
    );
    fastify.put(
        '/learner-summaries/:summaryId/excluded',
        {
            preHandler: fastify.rateLimit({
                max: 30,
                timeWindow: '1 minute',
                keyGenerator: (request) =>
                    `exclude-summary:${request.user?.id ?? request.ip}`,
            }),
            schema: {
                params: summaryParams,
                body: excludedBody,
                response: { 200: excludedResponse },
            },
        },
        excludeSummary,
    );
    fastify.put(
        '/classes/:classId/students/:studentId/adaptations/:subject',
        {
            schema: {
                params: adaptationParams,
                body: adaptationBody,
                response: { 200: adaptationItem },
            },
        },
        setAdaptation,
    );
};
