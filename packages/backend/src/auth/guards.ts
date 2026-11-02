import type { FastifyRequest } from 'fastify';
import type { role } from '../db/schema.ts';
import { AppError, AssertionError } from '../lib/errors.ts';

export type Role = (typeof role.enumValues)[number];

export type RequestUser = {
    id: number;
    role: Role;
    name: string;
    username: string;
    sessionId: string;
};

declare module 'fastify' {
    interface FastifyRequest {
        user?: RequestUser;
    }
}

export async function requireUser(request: FastifyRequest): Promise<void> {
    if (!request.user) {
        throw new AppError(401, {
            message: 'Login required',
            code: 'UNAUTHORIZED',
        });
    }
}

export function requireRole(...allowed: Role[]) {
    return async (request: FastifyRequest): Promise<void> => {
        if (!request.user) {
            throw new AppError(401, {
                message: 'Login required',
                code: 'UNAUTHORIZED',
            });
        }

        if (!allowed.includes(request.user.role)) {
            throw new AppError(403, {
                message: 'Forbidden',
                code: 'FORBIDDEN',
            });
        }
    };
}

export function currentUser(request: FastifyRequest): RequestUser {
    if (!request.user) {
        throw new AssertionError(
            `${request.method} ${request.url} reads the user without a guard`,
        );
    }

    return request.user;
}
