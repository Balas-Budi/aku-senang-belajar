import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import {
    draftCompetencies,
    getMaterial,
    deleteModule,
    getPage,
    listMaterials,
    readAgain,
    renameModule,
    saveModule,
    updateMaterial,
    uploadMaterial,
    uploadVersion,
} from './handlers.ts';
import { MAX_PDF_BYTES, PDF_CONTENT_TYPE } from './pdf.ts';
import {
    competencyProposal,
    materialBody,
    materialDetail,
    materialParams,
    materialSummary,
    moduleBody,
    moduleParams,
    moduleTitle,
    pageParams,
    pageQuery,
    pageRange,
    pageText,
    readingStarted,
    savedModule,
    uploadQuery,
} from './schema.ts';

export const materialRoutes: FastifyPluginAsyncZod = async (fastify) => {
    fastify.addHook('onRequest', requireRole('teacher'));
    fastify.addContentTypeParser(
        PDF_CONTENT_TYPE,
        { parseAs: 'buffer', bodyLimit: MAX_PDF_BYTES },
        (_request, body, done) => done(null, body),
    );

    fastify.get(
        '/',
        { schema: { response: { 200: z.array(materialSummary) } } },
        listMaterials,
    );
    fastify.post(
        '/',
        {
            schema: {
                querystring: uploadQuery,
                response: { 201: materialDetail },
            },
        },
        uploadMaterial,
    );
    fastify.get(
        '/:materialId',
        {
            schema: {
                params: materialParams,
                response: { 200: materialDetail },
            },
        },
        getMaterial,
    );
    fastify.put(
        '/:materialId',
        {
            schema: {
                params: materialParams,
                body: materialBody,
                response: { 200: materialDetail },
            },
        },
        updateMaterial,
    );
    fastify.post(
        '/:materialId/versions',
        {
            schema: {
                params: materialParams,
                response: { 201: materialDetail },
            },
        },
        uploadVersion,
    );
    fastify.get(
        '/:materialId/pages/:number',
        {
            schema: {
                params: pageParams,
                querystring: pageQuery,
                response: { 200: pageText },
            },
        },
        getPage,
    );
    fastify.post(
        '/:materialId/competency-drafts',
        {
            schema: {
                params: materialParams,
                body: pageRange,
                response: { 200: competencyProposal },
            },
        },
        draftCompetencies,
    );
    fastify.post(
        '/:materialId/modules',
        {
            schema: {
                params: materialParams,
                body: moduleBody,
                response: { 201: savedModule },
            },
        },
        saveModule,
    );
    fastify.post(
        '/:materialId/reading',
        {
            schema: {
                params: materialParams,
                response: { 202: readingStarted },
            },
        },
        readAgain,
    );
    fastify.patch(
        '/:materialId/modules/:moduleId',
        {
            schema: {
                params: moduleParams,
                body: moduleTitle,
                response: { 200: materialDetail },
            },
        },
        renameModule,
    );
    fastify.delete(
        '/:materialId/modules/:moduleId',
        { schema: { params: moduleParams } },
        deleteModule,
    );
};
