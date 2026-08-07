import type { ChannelToolContext } from '@copilotkit/channels';
import { z } from 'zod';
import type { StandupChannelDomain } from './standup-channel-domain';
import { createStandupChannelTools } from './standup-tools';

const team = {
  id: 'team-1',
  name: 'Soverius AI',
  timeZone: 'Europe/Vienna',
};

const receipt = {
  team,
  date: '2026-08-06',
  member: { memberId: 'member-1', displayName: 'Ada' },
  submittedAt: '2026-08-06T08:15:00.000Z',
  blockerCount: 1,
  updated: false,
};

const pulse = {
  team,
  date: '2026-08-06',
  generatedAt: '2026-08-06T08:15:00.000Z',
  totals: {
    roster: 2,
    posted: 1,
    missing: 1,
    blocked: 1,
    participationPct: 50,
  },
  deltas: { posted: 1, missing: -1, blocked: 1, participationPoints: 50 },
  standups: [],
  trend: [{ date: '2026-08-06', participationPct: 50 }],
  blockers: [],
};

const digest = { team, date: '2026-08-06', blockers: [] };

function setup() {
  const posts: unknown[] = [];
  const domain: StandupChannelDomain = {
    submitStandup: vi.fn().mockResolvedValue(receipt),
    getTeamPulse: vi.fn().mockResolvedValue(pulse),
    getBlockerDigest: vi.fn().mockResolvedValue(digest),
  };
  const context = {
    thread: {
      post: async (value: unknown) => {
        posts.push(value);
        return { id: `post-${posts.length}` };
      },
    },
    message: {
      text: 'Yesterday shipped. Today test. Blocked by access.',
      user: null,
      actor: { id: 'U-TRUSTED', kind: 'human' as const },
      ref: { id: 'revision-1' },
      platform: 'slack',
      operation: {
        kind: 'created' as const,
        logicalMessageId: 'logical-1',
        revisionId: 'revision-1',
        mentioned: true,
      },
      eventId: 'event-1',
    },
    user: null,
    actor: { id: 'U-TRUSTED', kind: 'human' as const },
    platform: 'slack',
  } as unknown as ChannelToolContext;

  return { context, domain, posts, tools: createStandupChannelTools(domain) };
}

describe('Standup Channel tools', () => {
  it('rejects identity fields from model-controlled submit arguments', () => {
    const { tools } = setup();
    const schema = tools[0].parameters as z.ZodType;

    expect(() =>
      schema.parse({
        yesterday: 'Shipped',
        today: 'Test',
        blockers: [],
        memberId: 'spoofed-member',
        teamId: 'spoofed-team',
      }),
    ).toThrow();
  });

  it('derives actor and idempotency references from trusted Channel context', async () => {
    const { context, domain, posts, tools } = setup();
    const input = {
      yesterday: 'Shipped',
      today: 'Test',
      blockers: ['Access'],
    };

    await tools[0].handler(input, context);

    expect(domain.submitStandup).toHaveBeenCalledWith(
      {
        platform: 'slack',
        providerActorId: 'U-TRUSTED',
        sourceMessageId: 'logical-1',
        sourceEventId: 'event-1',
      },
      input,
    );
    expect(posts).toHaveLength(1);
  });

  it('does not treat another provider actor as a Slack identity', async () => {
    const { context, domain, posts, tools } = setup();
    const teamsContext = {
      ...context,
      platform: 'teams',
      message: { ...context.message, platform: 'teams' },
    } as ChannelToolContext;

    const result = await tools[0].handler(
      { yesterday: 'Shipped', today: 'Test', blockers: [] },
      teamsContext,
    );

    expect(domain.submitStandup).not.toHaveBeenCalled();
    expect(posts).toHaveLength(0);
    expect(result).toContain('Slack message');
  });

  it('renders a summary plus a native Slack chart from stored pulse data', async () => {
    const { context, domain, posts, tools } = setup();

    const result = await tools[1].handler({}, context);

    expect(domain.getTeamPulse).toHaveBeenCalledWith();
    expect(posts).toHaveLength(2);
    expect(result).toContain('2026-08-06');
  });

  it('keeps provider-specific charts out of portable Channel replies', async () => {
    const { context, posts, tools } = setup();
    const teamsContext = {
      ...context,
      platform: 'teams',
      message: { ...context.message, platform: 'teams' },
    } as ChannelToolContext;

    await tools[1].handler({}, teamsContext);

    expect(posts).toHaveLength(1);
  });

  it('rejects a model-invented work date for current pulse tools', () => {
    const { tools } = setup();
    const schema = tools[1].parameters as z.ZodType;

    expect(() => schema.parse({ date: '2025-05-14' })).toThrow();
  });
});
