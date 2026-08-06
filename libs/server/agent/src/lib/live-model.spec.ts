import { RequestContext } from '@mastra/core/request-context';
import { createLocalGemmaModel, loadLocalModelConfig } from './local-model';
import {
  createStandupPulseAgent,
  type StandupPulseReadService,
  type TrustedAgentContext,
} from './standup-agent';

const liveTest =
  process.env['RUN_LOCAL_MODEL_TESTS'] === '1' ? describe : describe.skip;

liveTest('live local Gemma through Mastra', () => {
  it('answers the first team-pulse message through a real model-backed tool call', async () => {
    const readService: StandupPulseReadService = {
      getMyStandup: vi.fn(async () => null),
      getTeamPulse: vi.fn(async () => ({
        team: {
          id: 'team-default',
          name: 'Standup Pulse',
          timeZone: 'Europe/Vienna',
        },
        date: '2026-08-06',
        generatedAt: '2026-08-06T08:00:00.000Z',
        totals: {
          roster: 3,
          posted: 2,
          missing: 1,
          blocked: 1,
          participationPct: 66.7,
        },
        deltas: {
          posted: 1,
          missing: -1,
          blocked: 0,
          participationPoints: 33.4,
        },
        standups: [
          {
            memberId: 'member-missing',
            displayName: 'Missing Member',
            status: 'missing',
          },
        ],
        trend: [{ date: '2026-08-06', participationPct: 66.7 }],
        blockers: [],
      })),
      listBlockers: vi.fn(async () => []),
    };
    const agent = createStandupPulseAgent({
      model: createLocalGemmaModel(loadLocalModelConfig()),
      readService,
    });
    const context = new RequestContext<TrustedAgentContext>([
      ['actorId', 'member-admin'],
      ['teamId', 'team-default'],
      ['timezone', 'Europe/Vienna'],
    ]);

    const response = await agent.generate('Show the team pulse for today.', {
      requestContext: context,
      maxSteps: 3,
    });

    expect(readService.getTeamPulse).toHaveBeenCalled();
    expect(readService.getTeamPulse).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({ localDate: expect.anything() }),
    );
    expect(response.text.trim().length).toBeGreaterThan(0);
  }, 30_000);
});
