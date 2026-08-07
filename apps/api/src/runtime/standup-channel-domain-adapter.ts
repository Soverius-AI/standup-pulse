import type {
  BlockerDigestViewModel,
  StandupReceiptViewModel,
  SubmitStandupInput,
  TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';
import type { StandupChannelDomain, TrustedChannelActor } from '../channels';
import { DEFAULT_TEAM_SCOPE, type TrustedActorResolver } from '../data';
import {
  getLocalDate,
  StandupDomainError,
  type StandupService,
} from '../domain';

export class StandupChannelDomainAdapter implements StandupChannelDomain {
  constructor(
    private readonly service: StandupService,
    private readonly actorResolver: TrustedActorResolver,
  ) {}

  async submitStandup(
    actor: TrustedChannelActor,
    input: SubmitStandupInput,
  ): Promise<StandupReceiptViewModel | null> {
    try {
      const trustedActor = await this.actorResolver.resolveSlackActor(
        DEFAULT_TEAM_SCOPE,
        { externalUserId: actor.providerActorId },
      );
      return this.service.submitStandup(trustedActor, input, {
        source: 'slack',
        sourceMessageId: actor.sourceMessageId,
        ...(actor.sourceEventId ? { sourceEventId: actor.sourceEventId } : {}),
      });
    } catch (error) {
      if (
        error instanceof StandupDomainError &&
        error.code === 'EXTERNAL_ACTOR_NOT_LINKED'
      ) {
        return null;
      }
      throw error;
    }
  }

  async getTeamPulse(): Promise<TeamPulseViewModel> {
    const team = await this.service.getTeam();
    return this.service.getTeamPulse(getLocalDate(new Date(), team.timeZone));
  }

  async getBlockerDigest(): Promise<BlockerDigestViewModel> {
    const pulse = await this.getTeamPulse();
    return {
      team: pulse.team,
      date: pulse.date,
      blockers: pulse.blockers,
    };
  }
}
