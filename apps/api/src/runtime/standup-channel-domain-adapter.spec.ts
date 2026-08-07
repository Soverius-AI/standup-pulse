import type {
  StandupReceiptViewModel,
  TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';
import { DEFAULT_TEAM_SCOPE, type TrustedActorResolver } from '../data';
import {
  StandupDomainError,
  type StandupService,
  type TrustedActor,
} from '../domain';
import { StandupChannelDomainAdapter } from './standup-channel-domain-adapter';

const team = {
  id: 'team-1',
  name: 'Soverius AI',
  timeZone: 'Europe/Vienna',
};

const pulse = {
  team,
  date: '2026-08-11',
  generatedAt: '2026-08-11T08:15:00.000Z',
  totals: {
    roster: 2,
    posted: 1,
    missing: 1,
    blocked: 1,
    participationPct: 50,
  },
  deltas: { posted: 1, missing: -1, blocked: 1, participationPoints: 50 },
  standups: [],
  trend: [],
  blockers: [],
} satisfies TeamPulseViewModel;

const receipt = {
  team,
  date: '2026-08-11',
  member: { memberId: 'member-1', displayName: 'Ada' },
  submittedAt: '2026-08-11T08:15:00.000Z',
  blockerCount: 0,
  updated: false,
} satisfies StandupReceiptViewModel;

const trustedActor: TrustedActor = {
  memberId: 'member-1',
  externalActorId: 'U123',
  source: 'slack',
};

function setup() {
  const service = {
    submitStandup: vi.fn().mockResolvedValue(receipt),
    getTeam: vi.fn().mockResolvedValue(team),
    getTeamPulse: vi.fn().mockResolvedValue(pulse),
  } as unknown as StandupService;
  const actorResolver = {
    resolveSlackActor: vi.fn().mockResolvedValue(trustedActor),
  } as unknown as TrustedActorResolver;

  return {
    actorResolver,
    service,
    adapter: new StandupChannelDomainAdapter(service, actorResolver),
  };
}

describe('Standup Channel domain adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves provider identity before writing a standup', async () => {
    const { actorResolver, service, adapter } = setup();
    const input = { yesterday: 'Shipped', today: 'Test', blockers: [] };

    const result = await adapter.submitStandup(
      {
        platform: 'slack',
        providerActorId: 'U123',
        sourceMessageId: 'message-1',
        sourceEventId: 'event-1',
      },
      input,
    );

    expect(actorResolver.resolveSlackActor).toHaveBeenCalledWith(
      DEFAULT_TEAM_SCOPE,
      { externalUserId: 'U123' },
    );
    expect(service.submitStandup).toHaveBeenCalledWith(trustedActor, input, {
      source: 'slack',
      sourceMessageId: 'message-1',
      sourceEventId: 'event-1',
    });
    expect(result).toBe(receipt);
  });

  it('returns null only for an unlinked provider actor', async () => {
    const { actorResolver, adapter } = setup();
    vi.mocked(actorResolver.resolveSlackActor).mockRejectedValue(
      new StandupDomainError(
        'EXTERNAL_ACTOR_NOT_LINKED',
        'Slack actor is not linked',
      ),
    );

    await expect(
      adapter.submitStandup(
        {
          platform: 'slack',
          providerActorId: 'unknown',
          sourceMessageId: 'message-1',
        },
        { yesterday: 'Shipped', today: 'Test', blockers: [] },
      ),
    ).resolves.toBeNull();
  });

  it('does not hide unexpected identity failures', async () => {
    const { actorResolver, adapter } = setup();
    const failure = new Error('identity store unavailable');
    vi.mocked(actorResolver.resolveSlackActor).mockRejectedValue(failure);

    await expect(
      adapter.submitStandup(
        {
          platform: 'slack',
          providerActorId: 'U123',
          sourceMessageId: 'message-1',
        },
        { yesterday: 'Shipped', today: 'Test', blockers: [] },
      ),
    ).rejects.toBe(failure);
  });

  it('derives blocker digests from the stored current-day pulse', async () => {
    const { service, adapter } = setup();

    const digest = await adapter.getBlockerDigest();

    expect(service.getTeamPulse).toHaveBeenCalledWith('2026-08-11');
    expect(digest).toEqual({
      team: pulse.team,
      date: pulse.date,
      blockers: pulse.blockers,
    });
  });
});
