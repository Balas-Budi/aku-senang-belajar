import { QueryClient } from '@tanstack/react-query';
import { redirect } from 'react-router';
import { meQuery, roleHome, type Role } from '../features/auth/queries';
import { ApiError } from './api';
export async function requireUser(request: Request, role?: Role) {
    const client = new QueryClient();
    try {
        const user = await client.fetchQuery(
            meQuery(request.headers.get('cookie')),
        );
        if (role && user.role !== role) throw redirect(roleHome(user.role));
        return { client, user, cookie: request.headers.get('cookie') };
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            const url = new URL(request.url);
            throw redirect(
                `/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`,
            );
        }
        throw error;
    }
}
