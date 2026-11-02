import type { FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from './errors.ts';

export function registerErrorHandling(app: FastifyInstance): void {
    app.setErrorHandler((error, request, reply) => {
        if (hasZodFastifySchemaValidationErrors(error)) {
            return reply.code(400).send({
                name: 'VALIDATION_ERROR',
                message: 'Input values are invalid',
                details: error.validation.map((issue) => ({
                    field: issue.instancePath.replace(/^\//, '') || '_',
                    message: issue.message,
                })),
            });
        }

        if (error instanceof AppError) {
            request.log.error(
                { err: error, private: error.context?.private },
                error.code,
            );

            if (error.catastrophic) {
                setImmediate(() => process.exit(1));
            }

            return reply.code(error.statusCode).send({
                name: error.code,
                message: error.message,
                ...(error.context?.public
                    ? { details: error.context.public }
                    : {}),
            });
        }

        const statusCode = statusCodeOf(error);

        request.log.error({ err: error }, 'unhandled error');

        return reply.code(statusCode).send({
            name: statusCode >= 500 ? 'INTERNAL_ERROR' : codeOf(error),
            message:
                statusCode >= 500 || !(error instanceof Error)
                    ? 'An error occurred'
                    : error.message,
        });
    });

    app.setNotFoundHandler((request, reply) => {
        reply.code(404).send({
            name: 'NOT_FOUND',
            message: `Route ${request.method} ${request.url} does not exist`,
        });
    });
}

function statusCodeOf(error: unknown): number {
    if (
        error instanceof Error &&
        'statusCode' in error &&
        typeof error.statusCode === 'number' &&
        error.statusCode >= 400
    ) {
        return error.statusCode;
    }

    return 500;
}

function codeOf(error: unknown): string {
    if (
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string'
    ) {
        return error.code;
    }

    return 'REQUEST_ERROR';
}
