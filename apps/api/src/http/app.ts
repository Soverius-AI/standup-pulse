import { Hono } from 'hono';
import { registerErrorHandling } from './error-handler';
import type { ApiDependencies, RouteContext } from './route-context';
import { registerHealthRoutes } from './routes/health';
import { registerNudgeRoutes } from './routes/nudges';
import { registerRosterRoutes } from './routes/roster';
import { registerStatusRoutes } from './routes/status';
import { registerTeamPulseRoutes } from './routes/team-pulse';

export type { ApiDependencies } from './route-context';

export function createApiApp(dependencies: ApiDependencies): Hono {
  const app = new Hono();
  const context: RouteContext = {
    ...dependencies,
    now: dependencies.now ?? (() => new Date()),
  };

  registerHealthRoutes(app, context);
  registerStatusRoutes(app, context);
  registerRosterRoutes(app, context);
  registerTeamPulseRoutes(app, context);
  registerNudgeRoutes(app, context);
  registerErrorHandling(app);

  return app;
}
