import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { requireRole } from '../../auth/guards.ts';
import {
    getMaterial,
    getPage,
    listMaterials,
    uploadMaterial,
} from './handlers.ts';
import { MAX_PDF_BYTES, PDF_CONTENT_TYPE } from './pdf.ts';
import {
    materialDetail,
    materialParams,
    materialSummary,
    pageParams,
    pageText,
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
    fastify.get(
        '/:materialId/pages/:number',
        { schema: { params: pageParams, response: { 200: pageText } } },
        getPage,
    );
};
