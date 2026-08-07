import {
  CreateRosterMemberRequestSchema,
  RosterMemberSchema,
  RosterResponseSchema,
  UpdateRosterMemberRequestSchema,
} from '@standup-pulse/shared-contracts';
import type { MemberRecord } from '../../domain';
import type { Hono } from 'hono';
import type { RouteContext } from '../route-context';
import { jsonBody } from '../validation';

export function registerRosterRoutes(app: Hono, context: RouteContext): void {
  app.get('/api/roster', async (c) => {
    const response = RosterResponseSchema.parse(
      await context.service.getRoster(),
    );
    return c.json(response);
  });

  app.post(
    '/api/roster/members',
    jsonBody(CreateRosterMemberRequestSchema),
    async (c) => {
      const body = c.req.valid('json');
      const member = await context.service.createRosterMember(
        body,
        context.now(),
      );
      return c.json(RosterMemberSchema.parse(toRosterMember(member)), 201);
    },
  );

  app.patch(
    '/api/roster/members/:memberId',
    jsonBody(UpdateRosterMemberRequestSchema),
    async (c) => {
      const body = c.req.valid('json');
      const member = await context.service.updateRosterMember(
        c.req.param('memberId'),
        body,
        context.now(),
      );
      return c.json(RosterMemberSchema.parse(toRosterMember(member)));
    },
  );
}

function toRosterMember(member: MemberRecord) {
  return {
    id: member.id,
    displayName: member.displayName,
    ...(member.email ? { email: member.email } : {}),
    ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
    slackLinked: Boolean(member.slackUserId),
    active: member.active,
  };
}
