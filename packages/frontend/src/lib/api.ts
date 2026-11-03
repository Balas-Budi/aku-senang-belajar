type ErrorBody = {
    name: string;
    message: string;
    details?: { field: string; message: string }[];
};
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly body: ErrorBody,
    ) {
        super(body.message);
    }
}
const origin = import.meta.env.SSR
    ? (process.env.API_ORIGIN ?? 'http://127.0.0.1:3000')
    : '';
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has('content-type'))
        headers.set('content-type', 'application/json');
    const response = await fetch(`${origin}${path}`, { ...init, headers });
    if (!response.ok) {
        const body = await response.json().catch(() => ({
            name: 'HTTP_ERROR',
            message: response.statusText,
        }));
        if (
            response.status === 401 &&
            !import.meta.env.SSR &&
            window.location.pathname !== '/login'
        ) {
            window.location.replace(
                `/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`,
            );
        }
        throw new ApiError(response.status, body);
    }
    if (response.status === 204) return undefined as T;
    return response.json();
}
