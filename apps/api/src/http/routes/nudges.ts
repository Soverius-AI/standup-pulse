import {
  NudgeRequestSchema,
  NudgeResponseSchema,
} from '@standup-pulse/shared-contracts';
import type { Hono } from 'hono';
import type { RouteContext } from '../route-context';
import { jsonBody } from '../validation';

export function registerNudgeRoutes(app: Hono, context: RouteContext): void {
  app.post('/api/nudges', jsonBody(NudgeRequestSchema), async (c) => {
    const body = c.req.valid('json');
    const nudgeRequester = context.nudgeService ?? context.service;
    const response = NudgeResponseSchema.parse(
      await nudgeRequester.requestNudges(
        body.memberIds,
        body.date,
        body.requestId,
        context.now(),
      ),
    );
    return c.json(response);
  });
}
