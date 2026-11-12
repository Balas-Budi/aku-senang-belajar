import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import { feedbackResponse, reviewTryBody } from '../student/schema.ts';
import {
    answerFollowUp,
    classFollowUps,
    createFollowUp,
    markFollowUp,
    myFollowUp,
    myFollowUps,
} from './handlers.ts';
import {
    classParams,
    createBody,
    doneBody,
    followUpParams,
    followUpResponse,
    followUpsResponse,
    studentFollowUpParams,
    studentFollowUpResponse,
    studentFollowUpsQuery,
    studentFollowUpsResponse,
} from './schema.ts';

const path = '/classes/:classId/follow-ups';
const teacher = { preHandler: requireRole('teacher') };
const student = { preHandler: requireRole('student') };

export const followUpRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        path,
        {
            ...teacher,
            schema: {
                params: classParams,
                response: { 200: followUpsResponse },
            },
        },
        classFollowUps,
    );
    fastify.post(
        path,
        {
            ...teacher,
            schema: {
                params: classParams,
                body: createBody,
                response: { 201: followUpResponse },
            },
        },
        createFollowUp,
    );
    fastify.put(
        `${path}/:followUpId`,
        {
            ...teacher,
            schema: {
                params: followUpParams,
                body: doneBody,
                response: { 200: followUpResponse },
            },
        },
        markFollowUp,
    );
    fastify.get(
        '/student/follow-ups',
        {
            ...student,
            schema: {
                querystring: studentFollowUpsQuery,
                response: { 200: studentFollowUpsResponse },
            },
        },
        myFollowUps,
    );
    fastify.get(
        '/student/follow-ups/:followUpId',
        {
            ...student,
            schema: {
                params: studentFollowUpParams,
                response: { 200: studentFollowUpResponse },
            },
        },
        myFollowUp,
    );
    fastify.post(
        '/student/follow-ups/:followUpId/tries',
        {
            ...student,
            schema: {
                params: studentFollowUpParams,
                body: reviewTryBody,
                response: { 201: feedbackResponse },
            },
        },
        answerFollowUp,
    );
};
