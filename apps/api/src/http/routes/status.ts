import { StatusResponseSchema } from '@standup-pulse/shared-contracts';
import type { Hono } from 'hono';
import type { ExternalRuntimeStatus } from '../../runtime/runtime-status';
import type { RouteContext } from '../route-context';

export function registerStatusRoutes(app: Hono, context: RouteContext): void {
  app.get('/api/status', async (c) => {
    const team = await context.service.getTeam();
    const scheduler = context.scheduler.status();
    const external = context.runtimeStatus
      ? await context.runtimeStatus()
      : defaultRuntimeStatus();
    const response = StatusResponseSchema.parse({
      service: { state: 'online' },
      database: context.database.ping()
        ? { state: 'online' }
        : { state: 'offline', message: 'Database health check failed' },
      ...external,
      scheduler: {
        state: scheduler.running ? 'online' : 'degraded',
        timeZone: team.timeZone,
        ...(scheduler.lastRunAt
          ? { lastRunAt: scheduler.lastRunAt.toISOString() }
          : {}),
        ...(scheduler.lastError
          ? { message: `Last scheduler error: ${scheduler.lastError}` }
          : {}),
      },
      capabilities: {
        proactiveNudges: context.nudgeService?.available === true,
      },
    });
    return c.json(response);
  });
}

function defaultRuntimeStatus(): ExternalRuntimeStatus {
  return {
    model: {
      state: 'degraded',
      message: 'Local model health adapter is not attached',
    },
    agent: { state: 'degraded', message: 'Mastra runtime is not attached' },
    channel: { state: 'offline', message: 'Managed Channel is not attached' },
  };
}
