import type { Hono } from 'hono';
import type { RouteContext } from '../route-context';

export function registerHealthRoutes(app: Hono, context: RouteContext): void {
  app.get('/health/live', (c) => c.json({ status: 'ok' }));

  app.get('/health/ready', (c) => {
    const ready = context.database.ping();
    return c.json({ status: ready ? 'ready' : 'not-ready' }, ready ? 200 : 503);
  });
}
