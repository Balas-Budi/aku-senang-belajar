import { z } from 'zod';

const blankAsUnset = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().default('127.0.0.1'),
    DATABASE_URL: z.url(),
    APP_ORIGIN: z
        .url()
        .default('http://127.0.0.1:4200')
        .transform((value) => new URL(value).origin),
    LOG_LEVEL: z
        .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
        .default('info'),
    AI_BASE_URL: z.preprocess(
        blankAsUnset,
        z
            .url()
            .transform((value) =>
                value.replace(/\/+$/, '').replace(/\/chat\/completions$/, ''),
            )
            .optional(),
    ),
    AI_API_KEY: z.preprocess(blankAsUnset, z.string().trim().min(1).optional()),
    AI_MODEL: z.preprocess(blankAsUnset, z.string().trim().min(1).optional()),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
    const result = envSchema.safeParse(source);

    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');

        throw new Error(`Invalid environment: ${issues}`);
    }

    return result.data;
}
