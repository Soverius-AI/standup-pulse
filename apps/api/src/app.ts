import {
  CreateRosterMemberRequestSchema,
  ErrorResponseSchema,
  IsoDateSchema,
  NudgeRequestSchema,
  NudgeResponseSchema,
  RosterMemberSchema,
  RosterResponseSchema,
  StatusResponseSchema,
  TeamPulseViewModelSchema,
  UpdateRosterMemberRequestSchema,
  type StatusResponse,
} from '@standup-pulse/shared-contracts';
import type { StandupDatabase } from '@standup-pulse/standups-data';
import type { DailySnapshotScheduler } from '@standup-pulse/standups-data';
import {
  getLocalDate,
  StandupDomainError,
  type MemberRecord,
  type StandupService,
} from '@standup-pulse/standups-domain';
import { Hono } from 'hono';
import { z, ZodError } from 'zod';
import type { ProactiveNudgeService } from './slack-nudge-service';

const TeamPulseQuerySchema = z
  .object({
    date: IsoDateSchema.optional(),
  })
  .strict();

export interface ExternalRuntimeStatus {
  model: StatusResponse['model'];
  agent: StatusResponse['agent'];
  channel: StatusResponse['channel'];
}

export interface ApiDependencies {
  service: StandupService;
  database: StandupDatabase;
  scheduler: DailySnapshotScheduler;
  nudgeService?: ProactiveNudgeService;
  runtimeStatus?: () => ExternalRuntimeStatus | Promise<ExternalRuntimeStatus>;
  now?: () => Date;
}

export function createApiApp(dependencies: ApiDependencies): Hono {
  const app = new Hono();
  const now = dependencies.now ?? (() => new Date());

  app.get('/health/live', (c) => c.json({ status: 'ok' }));
  app.get('/health/ready', (c) => {
    const ready = dependencies.database.ping();
    return c.json({ status: ready ? 'ready' : 'not-ready' }, ready ? 200 : 503);
  });

  app.get('/api/status', async (c) => {
    const team = await dependencies.service.getTeam();
    const scheduler = dependencies.scheduler.status();
    const external = dependencies.runtimeStatus
      ? await dependencies.runtimeStatus()
      : defaultRuntimeStatus();
    const response = StatusResponseSchema.parse({
      service: { state: 'online' },
      database: dependencies.database.ping()
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
        proactiveNudges: dependencies.nudgeService?.available === true,
      },
    });
    return c.json(response);
  });

  app.get('/api/roster', async (c) => {
    const response = RosterResponseSchema.parse(
      await dependencies.service.getRoster(),
    );
    return c.json(response);
  });

  app.post('/api/roster/members', async (c) => {
    const body = CreateRosterMemberRequestSchema.parse(
      await readJson(c.req.raw),
    );
    const member = await dependencies.service.createRosterMember(body, now());
    return c.json(RosterMemberSchema.parse(toRosterMember(member)), 201);
  });

  app.patch('/api/roster/members/:memberId', async (c) => {
    const body = UpdateRosterMemberRequestSchema.parse(
      await readJson(c.req.raw),
    );
    const member = await dependencies.service.updateRosterMember(
      c.req.param('memberId'),
      body,
      now(),
    );
    return c.json(RosterMemberSchema.parse(toRosterMember(member)));
  });

  app.get('/api/team-pulse', async (c) => {
    const query = TeamPulseQuerySchema.parse(c.req.query());
    const team = await dependencies.service.getTeam();
    const date = query.date ?? getLocalDate(now(), team.timeZone);
    const response = TeamPulseViewModelSchema.parse(
      await dependencies.service.getTeamPulse(date, now()),
    );
    return c.json(response);
  });

  app.post('/api/nudges', async (c) => {
    const body = NudgeRequestSchema.parse(await readJson(c.req.raw));
    const response = NudgeResponseSchema.parse(
      await (dependencies.nudgeService ?? dependencies.service).requestNudges(
        body.memberIds,
        body.date,
        now(),
      ),
    );
    return c.json(response);
  });

  app.notFound((c) =>
    c.json(
      ErrorResponseSchema.parse({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      }),
      404,
    ),
  );

  app.onError((error, c) => {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return c.json(
        ErrorResponseSchema.parse({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Request validation failed',
          },
        }),
        400,
      );
    }
    if (error instanceof StandupDomainError) {
      const status =
        error.code === 'TEAM_NOT_FOUND' || error.code === 'MEMBER_NOT_FOUND'
          ? 404
          : 409;
      return c.json(
        ErrorResponseSchema.parse({
          error: {
            code: error.code,
            message: publicDomainErrorMessage(error.code),
          },
        }),
        status,
      );
    }

    console.error('Unhandled API error', { name: error.name });
    return c.json(
      ErrorResponseSchema.parse({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'The request could not be completed',
        },
      }),
      500,
    );
  });

  return app;
}

function defaultRuntimeStatus(): ExternalRuntimeStatus {
  return {
    model: {
      state: 'degraded',
      modelId: process.env['LOCAL_LLM_MODEL_ID'],
      message: 'Local model health adapter is not attached',
    },
    agent: { state: 'degraded', message: 'Mastra runtime is not attached' },
    channel: { state: 'offline', message: 'Managed Channel is not attached' },
  };
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

function publicDomainErrorMessage(code: StandupDomainError['code']): string {
  switch (code) {
    case 'TEAM_NOT_FOUND':
      return 'The configured team was not found';
    case 'MEMBER_NOT_FOUND':
      return 'Roster member not found';
    case 'ACTOR_NOT_IN_TEAM':
    case 'EXTERNAL_ACTOR_NOT_LINKED':
      return 'The requesting user is not linked to an active roster member';
    case 'INVALID_TIME_ZONE':
      return 'The configured team time zone is invalid';
    case 'PROACTIVE_DELIVERY_UNAVAILABLE':
      return 'Proactive delivery is unavailable';
  }
}

async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json'))
    throw new SyntaxError('Expected JSON');
  return request.json();
}
