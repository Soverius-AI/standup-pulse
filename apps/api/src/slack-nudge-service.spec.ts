import {
  DEFAULT_TEAM_SCOPE,
  seedFixtureData,
  SqliteStandupRepository,
  StandupDatabase,
} from '@standup-pulse/standups-data';
import { SlackNudgeService } from './slack-nudge-service';

describe('SlackNudgeService', () => {
  let database: StandupDatabase;

  afterEach(() => database?.close());

  function repository(): SqliteStandupRepository {
    database = new StandupDatabase();
    seedFixtureData(database.db);
    return new SqliteStandupRepository(database.db);
  }

  it('opens a direct message and sends a reminder for a linked member', async () => {
    const fetch = jest
      .fn<
        ReturnType<typeof globalThis.fetch>,
        Parameters<typeof globalThis.fetch>
      >()
      .mockResolvedValueOnce(
        response(
          { ok: true },
          { 'x-oauth-scopes': 'chat:write,im:write,users:read' },
        ),
      )
      .mockResolvedValueOnce(response({ ok: true, channel: { id: 'D123' } }))
      .mockResolvedValueOnce(response({ ok: true, ts: '1.2' }));
    const service = new SlackNudgeService({
      repository: repository(),
      scope: DEFAULT_TEAM_SCOPE,
      token: 'test-token',
      fetch,
    });

    await service.initialize();
    expect(service.available).toBe(true);
    await expect(
      service.requestNudges(
        ['member-ada'],
        '2026-08-06',
        new Date('2026-08-06T20:00:00.000Z'),
      ),
    ).resolves.toEqual({
      deliveries: [{ memberId: 'member-ada', status: 'sent' }],
      completedAt: '2026-08-06T20:00:00.000Z',
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://slack.com/api/conversations.open',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ users: 'U_FIXTURE_ADA' }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('2026-08-06'),
      }),
    );
  });

  it('does not call Slack for a roster member without a Slack link', async () => {
    const fetch = jest
      .fn<
        ReturnType<typeof globalThis.fetch>,
        Parameters<typeof globalThis.fetch>
      >()
      .mockResolvedValueOnce(
        response({ ok: true }, { 'x-oauth-scopes': 'chat:write,im:write' }),
      );
    const service = new SlackNudgeService({
      repository: repository(),
      scope: DEFAULT_TEAM_SCOPE,
      token: 'test-token',
      fetch,
    });

    await service.initialize();
    const result = await service.requestNudges(
      ['member-linus'],
      '2026-08-06',
      new Date('2026-08-06T20:00:00.000Z'),
    );

    expect(result.deliveries).toEqual([
      {
        memberId: 'member-linus',
        status: 'unavailable',
        message: 'Slack account is not linked.',
      },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stays unavailable when the bot lacks proactive scopes', async () => {
    const fetch = jest
      .fn<
        ReturnType<typeof globalThis.fetch>,
        Parameters<typeof globalThis.fetch>
      >()
      .mockResolvedValueOnce(
        response({ ok: true }, { 'x-oauth-scopes': 'chat:write' }),
      );
    const service = new SlackNudgeService({
      repository: repository(),
      scope: DEFAULT_TEAM_SCOPE,
      token: 'test-token',
      fetch,
    });

    await expect(service.initialize()).rejects.toThrow(
      'missing proactive delivery scopes',
    );
    expect(service.available).toBe(false);
  });
});

function response(
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
