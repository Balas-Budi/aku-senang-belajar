import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import { trackBackground } from '../../lib/background.ts';
import {
    addStory,
    approveSession,
    assignSession,
    chooseThemes,
    createSession,
    editBlock,
    getSession,
    moveBlock,
    redraftTheme,
    removeBlock,
    removeTheme,
    reviseSession,
    setEpisode,
    setReadAloud,
    updateTheme,
} from './handlers.ts';
import {
    accepted,
    approvalBody,
    assignmentBody,
    blockBody,
    blockParams,
    chosenThemes,
    classList,
    editedBlock,
    moduleParams,
    moveBody,
    episodeBody,
    readAloudBody,
    revisionBody,
    sessionBody,
    sessionParams,
    storyBody,
    studioSession,
    themeAccepted,
    themeBody,
    themeChange,
    themeParams,
    themesBody,
} from './schema.ts';

export const studioRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.addHook('preHandler', requireRole('teacher'));
    trackBackground(fastify);

    fastify.post(
        '/modules/:moduleId/sessions',
        {
            schema: {
                params: moduleParams,
                body: sessionBody,
                response: { 202: accepted },
            },
        },
        createSession,
    );
    fastify.get(
        '/studio/sessions/:sessionId',
        { schema: { params: sessionParams, response: { 200: studioSession } } },
        getSession,
    );
    fastify.post(
        '/studio/sessions/:sessionId/blocks',
        {
            schema: {
                params: sessionParams,
                body: storyBody,
                response: { 201: studioSession },
            },
        },
        addStory,
    );
    fastify.put(
        '/studio/sessions/:sessionId/blocks/:blockId/position',
        {
            schema: {
                params: blockParams,
                body: moveBody,
                response: { 200: studioSession },
            },
        },
        moveBlock,
    );
    fastify.delete(
        '/studio/sessions/:sessionId/blocks/:blockId',
        {
            schema: {
                params: blockParams,
                response: { 200: studioSession },
            },
        },
        removeBlock,
    );
    fastify.put(
        '/studio/sessions/:sessionId/read-aloud',
        {
            schema: {
                params: sessionParams,
                body: readAloudBody,
                response: { 200: studioSession },
            },
        },
        setReadAloud,
    );
    fastify.put(
        '/studio/sessions/:sessionId/episode',
        {
            schema: {
                params: sessionParams,
                body: episodeBody,
                response: { 200: studioSession },
            },
        },
        setEpisode,
    );
    fastify.put(
        '/studio/sessions/:sessionId/blocks/:blockId',
        {
            schema: {
                params: blockParams,
                body: blockBody,
                response: { 200: editedBlock },
            },
        },
        editBlock,
    );
    fastify.post(
        '/studio/sessions/:sessionId/revisions',
        {
            schema: {
                params: sessionParams,
                body: revisionBody,
                response: { 202: accepted },
            },
        },
        reviseSession,
    );
    fastify.post(
        '/studio/sessions/:sessionId/approval',
        {
            schema: {
                params: sessionParams,
                body: approvalBody,
                response: { 200: studioSession },
            },
        },
        approveSession,
    );
    fastify.post(
        '/studio/sessions/:sessionId/assignments',
        {
            schema: {
                params: sessionParams,
                body: assignmentBody,
                response: { 200: classList },
            },
        },
        assignSession,
    );
    fastify.post(
        '/studio/sessions/:sessionId/themes',
        {
            schema: {
                params: sessionParams,
                body: themesBody,
                response: { 202: chosenThemes },
            },
        },
        chooseThemes,
    );
    fastify.put(
        '/studio/sessions/:sessionId/themes/:theme',
        {
            schema: {
                params: themeParams,
                body: themeBody,
                response: { 200: themeChange },
            },
        },
        updateTheme,
    );
    fastify.post(
        '/studio/sessions/:sessionId/themes/:theme/draft',
        {
            schema: {
                params: themeParams,
                body: revisionBody,
                response: { 202: themeAccepted },
            },
        },
        redraftTheme,
    );
    fastify.delete(
        '/studio/sessions/:sessionId/themes/:theme',
        { schema: { params: themeParams } },
        removeTheme,
    );
};
