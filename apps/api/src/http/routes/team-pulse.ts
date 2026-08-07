import {
  IsoDateSchema,
  TeamPulseViewModelSchema,
} from '@standup-pulse/shared-contracts';
import { getLocalDate } from '../../domain';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { RouteContext } from '../route-context';

const TeamPulseQuerySchema = z
  .object({
    date: IsoDateSchema.optional(),
  })
  .strict();

export function registerTeamPulseRoutes(
  app: Hono,
  context: RouteContext,
): void {
  app.get('/api/team-pulse', async (c) => {
    const query = TeamPulseQuerySchema.parse(c.req.query());
    const team = await context.service.getTeam();
    const date = query.date ?? getLocalDate(context.now(), team.timeZone);
    const response = TeamPulseViewModelSchema.parse(
      await context.service.getTeamPulse(date, context.now()),
    );
    return c.json(response);
  });
}
