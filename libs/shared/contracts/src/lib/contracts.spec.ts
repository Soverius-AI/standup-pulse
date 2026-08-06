import {
  IsoDateSchema,
  StatusResponseSchema,
  SubmitStandupInputSchema,
  TeamPulseViewModelSchema,
} from './contracts';

describe('shared contracts', () => {
  it('accepts real dates and rejects calendar overflow', () => {
    expect(IsoDateSchema.parse('2026-08-06')).toBe('2026-08-06');
    expect(() => IsoDateSchema.parse('2026-02-30')).toThrow();
  });

  it('rejects model-controlled identity on standup input', () => {
    expect(() =>
      SubmitStandupInputSchema.parse({
        yesterday: 'Shipped the API',
        today: 'Build tests',
        blockers: [],
        memberId: 'spoofed-member',
        teamId: 'spoofed-team',
        channelId: 'spoofed-channel',
        threadId: 'spoofed-thread',
      }),
    ).toThrow();
  });

  it('validates the canonical team pulse shape', () => {
    expect(
      TeamPulseViewModelSchema.parse({
        team: {
          id: 'team-1',
          name: 'Standup Pulse',
          timeZone: 'Europe/Vienna',
        },
        date: '2026-08-06',
        generatedAt: '2026-08-06T08:00:00.000Z',
        totals: {
          roster: 1,
          posted: 1,
          missing: 0,
          blocked: 0,
          participationPct: 100,
        },
        deltas: {
          posted: 1,
          missing: -1,
          blocked: 0,
          participationPoints: 100,
        },
        standups: [
          {
            memberId: 'member-1',
            displayName: 'Ada',
            status: 'posted',
            preview: 'Build tests',
          },
        ],
        trend: [{ date: '2026-08-06', participationPct: 100 }],
        blockers: [],
      }).totals.participationPct,
    ).toBe(100);
  });

  it('makes proactive delivery capability explicit', () => {
    expect(
      StatusResponseSchema.parse({
        service: { state: 'online' },
        database: { state: 'online' },
        model: { state: 'degraded', modelId: 'gemma-4-26b' },
        agent: { state: 'degraded' },
        channel: { state: 'offline' },
        scheduler: { state: 'online', timeZone: 'Europe/Vienna' },
        capabilities: { proactiveNudges: false },
      }).capabilities.proactiveNudges,
    ).toBe(false);
  });
});
