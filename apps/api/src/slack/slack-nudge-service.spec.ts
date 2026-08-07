import {
  DEFAULT_TEAM_SCOPE,
  seedFixtureData,
  SqliteStandupRepository,
  StandupDatabase,
} from '../data';
import { IsoDateSchema } from '@standup-pulse/shared-contracts';
import { SlackNudgeService } from './slack-nudge-service';

const AUGUST_6 = IsoDateSchema.parse('2026-08-06');
const AUGUST_7 = IsoDateSchema.parse('2026-08-07');

describe('SlackNudgeService', () => {
  let database: StandupDatabase;

  afterEach(() => database?.close());

  function repository(): SqliteStandupRepository {
    database = new StandupDatabase();
    seedFixtureData(database.db);
    return new SqliteStandupRepository(database.db);
  }

  it('opens a direct message and sends a reminder for a linked member', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
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
        AUGUST_6,
        '5eab8df0-cd51-4d94-9f9f-c18ef89df132',
        new Date('2026-08-06T20:00:00.000Z'),
      ),
    ).resolves.toEqual({
      deliveries: [{ memberId: 'member-ada', status: 'sent' }],
      completedAt: '2026-08-06T20:00:00.000Z',
    });
    await expect(
      service.requestNudges(
        ['member-ada'],
        AUGUST_6,
        'fbc5b79d-0d9f-42be-a605-df154ad51429',
        new Date('2026-08-06T20:01:00.000Z'),
      ),
    ).resolves.toMatchObject({
      deliveries: [{ memberId: 'member-ada', status: 'sent' }],
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://slack.com/api/conversations.open',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ users: 'U_FIXTURE_ADA' }),
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(3);
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
    const fetch = vi
      .fn<typeof globalThis.fetch>()
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
      AUGUST_6,
      '5eab8df0-cd51-4d94-9f9f-c18ef89df132',
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
    const fetch = vi
      .fn<typeof globalThis.fetch>()
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

  it('clears readiness when Slack revokes the token', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        response({ ok: true }, { 'x-oauth-scopes': 'chat:write,im:write' }),
      )
      .mockResolvedValueOnce(response({ ok: false, error: 'invalid_auth' }));
    const service = new SlackNudgeService({
      repository: repository(),
      scope: DEFAULT_TEAM_SCOPE,
      token: 'test-token',
      fetch,
      sleep: async () => undefined,
    });

    await service.initialize();
    expect(service.available).toBe(true);
    await service.requestNudges(
      ['member-ada'],
      AUGUST_6,
      '5eab8df0-cd51-4d94-9f9f-c18ef89df132',
    );

    expect(service.available).toBe(false);
  });

  it('does not retry non-retryable Slack application errors', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        response({ ok: true }, { 'x-oauth-scopes': 'chat:write,im:write' }),
      )
      .mockResolvedValueOnce(
        response({ ok: false, error: 'channel_not_found' }),
      );
    const service = new SlackNudgeService({
      repository: repository(),
      scope: DEFAULT_TEAM_SCOPE,
      token: 'test-token',
      fetch,
      sleep: async () => undefined,
    });

    await service.initialize();
    await expect(
      service.requestNudges(
        ['member-ada'],
        AUGUST_7,
        '5eab8df0-cd51-4d94-9f9f-c18ef89df132',
      ),
    ).resolves.toMatchObject({
      deliveries: [{ memberId: 'member-ada', status: 'failed' }],
    });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('aborts a stalled Slack authentication request', async () => {
    const fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Timed out', 'AbortError')),
            { once: true },
          );
        }),
    );
    const service = new SlackNudgeService({
      repository: repository(),
      scope: DEFAULT_TEAM_SCOPE,
      token: 'test-token',
      fetch,
      requestTimeoutMs: 10,
    });

    await expect(service.initialize()).rejects.toMatchObject({
      name: 'AbortError',
    });
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
