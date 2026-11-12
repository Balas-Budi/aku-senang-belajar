import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import {
    answerChallenge,
    challengeSources,
    changeChallenge,
    classChallenge,
    myChallenge,
    startChallenge,
} from './handlers.ts';
import {
    answerBody,
    answeredResponse,
    challengeParams,
    challengeResponse,
    changeBody,
    sourcesResponse,
    startBody,
    startedResponse,
    studentChallengeResponse,
} from './schema.ts';

const path = '/classes/:classId/challenge';
const teacher = { preHandler: requireRole('teacher') };
const student = { preHandler: requireRole('student') };

export const challengeRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.get(
        path,
        {
            ...teacher,
            schema: {
                params: challengeParams,
                response: { 200: challengeResponse },
            },
        },
        classChallenge,
    );
    fastify.get(
        `${path}/sources`,
        {
            ...teacher,
            schema: {
                params: challengeParams,
                response: { 200: sourcesResponse },
            },
        },
        challengeSources,
    );
    fastify.post(
        path,
        {
            ...teacher,
            schema: {
                params: challengeParams,
                body: startBody,
                response: { 201: startedResponse },
            },
        },
        startChallenge,
    );
    fastify.put(
        path,
        {
            ...teacher,
            schema: {
                params: challengeParams,
                body: changeBody,
                response: { 200: startedResponse },
            },
        },
        changeChallenge,
    );
    fastify.get(
        '/student/challenge',
        { ...student, schema: { response: { 200: studentChallengeResponse } } },
        myChallenge,
    );
    fastify.post(
        '/student/challenge/answers',
        {
            ...student,
            schema: {
                body: answerBody,
                response: { 201: answeredResponse },
            },
        },
        answerChallenge,
    );
};
