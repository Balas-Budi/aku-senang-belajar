import type { FastifyInstance } from 'fastify';

const inFlight = new WeakMap<FastifyInstance, Set<Promise<void>>>();

export function trackBackground(app: FastifyInstance) {
    inFlight.set(app, new Set());
    app.addHook('onClose', async () => {
        await Promise.allSettled([...(inFlight.get(app) ?? [])]);
    });
}

export function inBackground(app: FastifyInstance, work: Promise<void>) {
    const tasks = inFlight.get(app);

    tasks?.add(work);
    void work.finally(() => tasks?.delete(work));
}
