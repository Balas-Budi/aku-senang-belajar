export function safeReturnTo(value: string | null, fallback = '/') {
    if (
        !value ||
        !value.startsWith('/') ||
        value.startsWith('//') ||
        /[\\\u0000-\u0020]/u.test(value)
    )
        return fallback;
    const path = value.split(/[?#]/u)[0];
    return path === '/login' ? fallback : value;
}
