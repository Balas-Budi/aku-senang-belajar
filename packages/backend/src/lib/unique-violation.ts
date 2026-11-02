export function isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    return (
        ('code' in error && error.code === '23505') ||
        isUniqueViolation(error.cause)
    );
}

export async function retryOnUniqueViolation<T>(
    attempt: () => Promise<T>,
    tries = 3,
): Promise<T> {
    for (let left = tries; ; left -= 1) {
        try {
            return await attempt();
        } catch (error) {
            if (left <= 1 || !isUniqueViolation(error)) {
                throw error;
            }
        }
    }
}
