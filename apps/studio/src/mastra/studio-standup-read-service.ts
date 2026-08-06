import {
  type BlockerView,
  type MyStandupView,
  type StandupPulseReadService,
  type TrustedAgentContext,
} from '@standup-pulse/standup-agent';
import {
  getLocalDate,
  type StandupService,
} from '@standup-pulse/standups-domain';
import type { TeamPulseViewModel } from '@standup-pulse/shared-contracts';

export class StudioStandupReadService implements StandupPulseReadService {
  constructor(private readonly service: StandupService) {}

  async getMyStandup(
    context: TrustedAgentContext,
    input: { readonly localDate?: string },
  ): Promise<MyStandupView | null> {
    const pulse = await this.getTeamPulse(context, input);
    const standup = pulse.standups.find(
      ({ memberId }) => memberId === context.actorId,
    );
    if (!standup) return null;

    return {
      localDate: pulse.date,
      submitted: standup.status !== 'missing',
      ...(standup.preview ? { today: standup.preview } : {}),
      blockers: pulse.blockers
        .filter(({ owner }) => owner.memberId === context.actorId)
        .map(({ title }) => title),
    };
  }

  async getTeamPulse(
    _context: TrustedAgentContext,
    input: { readonly localDate?: string },
  ): Promise<TeamPulseViewModel> {
    const team = await this.service.getTeam();
    const date = input.localDate ?? getLocalDate(new Date(), team.timeZone);
    return this.service.getTeamPulse(date);
  }

  async listBlockers(
    context: TrustedAgentContext,
    input: { readonly status?: 'open' | 'resolved'; readonly limit?: number },
  ): Promise<readonly BlockerView[]> {
    if (input.status === 'resolved') return [];
    const pulse = await this.getTeamPulse(context, {});
    return pulse.blockers.slice(0, input.limit ?? 100).map((blocker) => ({
      id: blocker.id,
      summary: blocker.title,
      ownerDisplayName: blocker.owner.displayName,
      status: 'open',
      ageDays: blocker.ageDays,
    }));
  }
}
