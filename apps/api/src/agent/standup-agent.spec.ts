import { RequestContext } from '@mastra/core/request-context';
import { MockLanguageModelV4 } from 'ai/test';
import { IsoDateSchema } from '@standup-pulse/shared-contracts';
import {
  createStandupPulseAgent,
  createStandupPulseReadTools,
  STANDUP_PULSE_INSTRUCTIONS,
  type StandupPulseReadService,
  TrustedAgentContextError,
  type TrustedAgentContext,
} from './standup-agent';

const trustedContext: TrustedAgentContext = {
  actorId: 'actor-1',
  teamId: 'team-1',
  timezone: 'Europe/Vienna',
  channelId: 'channel-1',
  threadId: 'thread-1',
};

function createReadService() {
  return {
    getMyStandup: vi.fn<StandupPulseReadService['getMyStandup']>(
      async () => null,
    ),
    getTeamPulse: vi.fn<StandupPulseReadService['getTeamPulse']>(async () => ({
      team: { id: 'team-1', name: 'Platform', timeZone: 'Europe/Vienna' },
      date: IsoDateSchema.parse('2026-08-06'),
      generatedAt: '2026-08-06T08:00:00.000Z',
      totals: {
        roster: 4,
        posted: 3,
        missing: 1,
        blocked: 2,
        participationPct: 75,
      },
      deltas: {
        posted: 1,
        missing: -1,
        blocked: 0,
        participationPoints: 25,
      },
      standups: [
        {
          memberId: 'member-missing',
          displayName: 'Missing Member',
          status: 'missing',
        },
      ],
      trend: [],
      blockers: [],
    })),
    listBlockers: vi.fn<StandupPulseReadService['listBlockers']>(
      async () => [],
    ),
  } satisfies StandupPulseReadService;
}

function requestContext(values: Partial<TrustedAgentContext> = trustedContext) {
  return new RequestContext<TrustedAgentContext>(
    Object.entries(values) as [keyof TrustedAgentContext, string][],
  );
}

describe('Standup Pulse tools', () => {
  it('uses trusted request context instead of model arguments', async () => {
    const readService = createReadService();
    const tools = createStandupPulseReadTools(readService);

    await tools.getTeamPulse.execute?.({ rangeDays: 7 }, {
      requestContext: requestContext(),
    } as never);

    expect(readService.getTeamPulse).toHaveBeenCalledWith(trustedContext, {
      rangeDays: 7,
    });
    const inputSchema = tools.getTeamPulse.inputSchema;
    expect(inputSchema).toBeDefined();
    expect(
      await inputSchema?.['~standard'].validate({
        rangeDays: 7,
        localDate: '2025-05-14',
        actorId: 'spoofed-actor',
        teamId: 'spoofed-team',
        timezone: 'UTC',
      }),
    ).toMatchObject({ issues: expect.any(Array) });
  });

  it('fails closed when trusted context is missing', async () => {
    const readService = createReadService();
    const tools = createStandupPulseReadTools(readService);

    const execution =
      tools.listBlockers.execute?.({ status: 'open' }, {
        requestContext: requestContext({ actorId: 'actor-1' }),
      } as never) ?? Promise.resolve();
    await expect(execution).rejects.toEqual(new TrustedAgentContextError());
    await expect(execution).rejects.not.toMatchObject({
      issues: expect.anything(),
    });
    expect(readService.listBlockers).not.toHaveBeenCalled();
  });

  it('accepts an injected fake language model without changing the agent', async () => {
    const model = new MockLanguageModelV4();
    const agent = createStandupPulseAgent({
      model,
      readService: createReadService(),
    });

    expect((await agent.getModel()).modelId).toBe('mock-model-id');
    expect(Object.keys(await agent.listTools())).toEqual([
      'getMyStandup',
      'getTeamPulse',
      'listBlockers',
    ]);
  });

  it('chooses one model-authored UI path per visual response', () => {
    expect(STANDUP_PULSE_INSTRUCTIONS).toContain(
      'a model authors the complete A2UI Basic Catalog surface',
    );
    expect(STANDUP_PULSE_INSTRUCTIONS).toContain(
      'Never call both UI tools for one response',
    );
    expect(STANDUP_PULSE_INSTRUCTIONS).not.toMatch(
      /renderMissingStandups|renderBlockerDigest|renderStandupWhatIf/i,
    );
  });

  it('adds the full-catalog A2UI generator only when configured', async () => {
    const agent = createStandupPulseAgent({
      model: new MockLanguageModelV4(),
      readService: createReadService(),
      a2ui: { recovery: { maxAttempts: 1 } },
    });

    expect(Object.keys(await agent.listTools())).toContain('generate_a2ui');
  });

  it('omits personal reads when provider identity is unavailable', async () => {
    const agent = createStandupPulseAgent({
      model: new MockLanguageModelV4(),
      readService: createReadService(),
      includePersonalTools: false,
    });

    expect(Object.keys(await agent.listTools())).not.toContain('getMyStandup');
  });
});
