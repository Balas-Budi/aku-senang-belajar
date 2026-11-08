import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import {
    answerBlock,
    askForHelp,
    assignmentDetail,
    joinClass,
    leaveClass,
    moveCheckpoint,
    myClass,
    myPath,
    myProfile,
    saveProfile,
    startAttempt,
    submitAttempt,
} from './handlers.ts';
import {
    assignmentParams,
    assignmentResponse,
    attemptParams,
    attemptResponse,
    checkpointBody,
    classroomResponse,
    doneResponse,
    feedbackResponse,
    helpBody,
    helpResponse,
    joinClassBody,
    pathResponse,
    profileBody,
    profileResponse,
    responseBody,
} from './schema.ts';

export const studentRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.addHook('preHandler', requireRole('student'));

    fastify.get(
        '/class',
        { schema: { response: { 200: classroomResponse } } },
        myClass,
    );
    fastify.post(
        '/class',
        {
            schema: {
                body: joinClassBody,
                response: { 201: classroomResponse },
            },
            preHandler: fastify.rateLimit({
                max: 10,
                timeWindow: '15 minutes',
                keyGenerator: (request) =>
                    `join-class:${request.user?.id ?? request.ip}`,
            }),
        },
        joinClass,
    );
    fastify.delete('/class', leaveClass);
    fastify.get(
        '/path',
        { schema: { response: { 200: pathResponse } } },
        myPath,
    );
    fastify.get(
        '/profile',
        { schema: { response: { 200: profileResponse } } },
        myProfile,
    );
    fastify.put(
        '/profile',
        { schema: { body: profileBody, response: { 200: profileResponse } } },
        saveProfile,
    );
    fastify.get(
        '/assignments/:assignmentId',
        {
            schema: {
                params: assignmentParams,
                response: { 200: assignmentResponse },
            },
        },
        assignmentDetail,
    );
    fastify.post(
        '/assignments/:assignmentId/attempt',
        {
            schema: {
                params: assignmentParams,
                response: { 200: attemptResponse, 201: attemptResponse },
            },
        },
        startAttempt,
    );
    fastify.put(
        '/attempts/:attemptId/checkpoint',
        { schema: { params: attemptParams, body: checkpointBody } },
        moveCheckpoint,
    );
    fastify.post(
        '/attempts/:attemptId/responses',
        {
            schema: {
                params: attemptParams,
                body: responseBody,
                response: { 200: feedbackResponse, 201: feedbackResponse },
            },
        },
        answerBlock,
    );
    fastify.post(
        '/attempts/:attemptId/help',
        {
            schema: {
                params: attemptParams,
                body: helpBody,
                response: { 201: helpResponse },
            },
        },
        askForHelp,
    );
    fastify.post(
        '/attempts/:attemptId/submit',
        {
            schema: {
                params: attemptParams,
                response: { 200: doneResponse },
            },
        },
        submitAttempt,
    );
};
