import {
  DEFAULT_TEAM_SCOPE,
  DailySnapshotScheduler,
  SchedulerRunStore,
  seedFixtureData,
  SqliteStandupRepository,
  StandupDatabase,
} from '../data';
import { StandupService } from '../domain';
import { createApiApp } from './app';
import type { ProactiveNudgeService } from '../slack/slack-nudge-service';

describe('Standup Pulse API', () => {
  const now = new Date('2026-08-06T08:00:00.000Z');
  let database: StandupDatabase;

  afterEach(() => database?.close());

  function fixture(nudgeService?: ProactiveNudgeService) {
    database = new StandupDatabase();
    seedFixtureData(database.db);
    const service = new StandupService(
      new SqliteStandupRepository(database.db),
      DEFAULT_TEAM_SCOPE,
    );
    const scheduler = new DailySnapshotScheduler(
      service,
      new SchedulerRunStore(database.sqlite),
    );
    return createApiApp({
      service,
      database,
      scheduler,
      ...(nudgeService ? { nudgeService } : {}),
      now: () => now,
    });
  }

  it('serves liveness, readiness, status, roster, and pulse contracts', async () => {
    const app = fixture();
    await expect((await app.request('/health/live')).json()).resolves.toEqual({
      status: 'ok',
    });
    await expect((await app.request('/health/ready')).json()).resolves.toEqual({
      status: 'ready',
    });

    const status = await (await app.request('/api/status')).json();
    expect(status).toMatchObject({
      service: { state: 'online' },
      database: { state: 'online' },
      capabilities: { proactiveNudges: false },
    });

    const roster = await (await app.request('/api/roster')).json();
    expect(roster.members).toHaveLength(3);

    const pulse = await (
      await app.request('/api/team-pulse?date=2026-08-06')
    ).json();
    expect(pulse).toMatchObject({
      team: { id: DEFAULT_TEAM_SCOPE.teamId, timeZone: 'Europe/Vienna' },
      date: '2026-08-06',
      totals: { roster: 3, posted: 0, missing: 3, participationPct: 0 },
    });
  });

  it('keeps inactive members visible in the administrative roster', async () => {
    const app = fixture();
    const updateResponse = await app.request('/api/roster/members/member-ada', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    expect(updateResponse.status).toBe(200);

    const roster = await (await app.request('/api/roster')).json();
    expect(roster.members).toHaveLength(3);
    expect(
      roster.members.find(
        (member: { id: string }) => member.id === 'member-ada',
      ),
    ).toMatchObject({ active: false });

    const pulse = await (
      await app.request('/api/team-pulse?date=2026-08-06')
    ).json();
    expect(pulse.totals.roster).toBe(2);
    expect(
      pulse.standups.some(
        (standup: { memberId: string }) => standup.memberId === 'member-ada',
      ),
    ).toBe(false);
  });

  it('rejects team, actor, channel, and thread identity spoofing with a sanitized error', async () => {
    const app = fixture();
    const response = await app.request(
      '/api/team-pulse?date=2026-08-06&teamId=other&actorId=other&channelId=other&threadId=other',
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Request validation failed' },
    });
  });

  it('returns truthful unavailable nudge results', async () => {
    const app = fixture();
    const response = await app.request('/api/nudges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        date: '2026-08-06',
        memberIds: ['member-ada'],
        requestId: '5eab8df0-cd51-4d94-9f9f-c18ef89df132',
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deliveries: [
        {
          memberId: 'member-ada',
          status: 'unavailable',
          message:
            'Proactive Slack delivery is not supported by the current managed Channel runtime.',
        },
      ],
      completedAt: now.toISOString(),
    });
  });

  it('reports and uses an available proactive Slack nudge adapter', async () => {
    const requestNudges = vi.fn(async () => ({
      deliveries: [{ memberId: 'member-ada', status: 'sent' as const }],
      completedAt: now.toISOString(),
    }));
    const app = fixture({ available: true, requestNudges });

    const status = await (await app.request('/api/status')).json();
    expect(status).toMatchObject({
      capabilities: { proactiveNudges: true },
    });

    const response = await app.request('/api/nudges', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        date: '2026-08-06',
        memberIds: ['member-ada'],
        requestId: '5eab8df0-cd51-4d94-9f9f-c18ef89df132',
      }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deliveries: [{ memberId: 'member-ada', status: 'sent' }],
      completedAt: now.toISOString(),
    });
    expect(requestNudges).toHaveBeenCalledWith(
      ['member-ada'],
      '2026-08-06',
      '5eab8df0-cd51-4d94-9f9f-c18ef89df132',
      now,
    );
  });

  it('sanitizes raw Zod validation details', async () => {
    const app = fixture();
    const response = await app.request('/api/roster/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: '', teamId: 'spoofed-team' }),
    });
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      error: { code: 'INVALID_REQUEST', message: 'Request validation failed' },
    });
    expect(text).not.toContain('displayName');
    expect(text).not.toContain('teamId');
    expect(text).not.toContain('too_small');
  });
});
