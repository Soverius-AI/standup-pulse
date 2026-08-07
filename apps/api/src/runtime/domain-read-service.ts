import type {
  BlockerView,
  MyStandupView,
  StandupPulseReadService,
  TrustedAgentContext,
} from '../agent';
import type {
  IsoDate,
  TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';
import { getLocalDate, type StandupService } from '../domain';

export class DomainReadService implements StandupPulseReadService {
  constructor(private readonly service: StandupService) {}

  async getMyStandup(
    context: TrustedAgentContext,
    input: { readonly localDate?: IsoDate },
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
    input: { readonly localDate?: IsoDate; readonly rangeDays?: number },
  ): Promise<TeamPulseViewModel> {
    const team = await this.service.getTeam();
    const date = input.localDate ?? getLocalDate(new Date(), team.timeZone);
    return this.service.getTeamPulse(date, new Date(), input.rangeDays ?? 7);
  }

  async listBlockers(
    context: TrustedAgentContext,
    input: { readonly status?: 'open' | 'resolved'; readonly limit?: number },
  ): Promise<readonly BlockerView[]> {
    const blockers = await this.service.listBlockers(
      input.status ?? 'open',
      input.limit ?? 100,
    );
    const now = new Date();
    return blockers.map(({ blocker, owner }) => ({
      id: blocker.id,
      summary: blocker.title,
      ownerDisplayName: owner.displayName,
      status: blocker.status,
      ageDays: Math.max(
        0,
        Math.floor((now.getTime() - blocker.openedAt.getTime()) / 86_400_000),
      ),
    }));
  }
}
