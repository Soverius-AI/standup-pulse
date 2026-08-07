import {
  StandupDomainError,
  type TeamScope,
  type TrustedActor,
} from '../domain';
import type { SqliteStandupRepository } from './repository';

export interface SlackActorInput {
  externalUserId: string;
}

export class TrustedActorResolver {
  constructor(private readonly repository: SqliteStandupRepository) {}

  async resolveSlackActor(
    scope: TeamScope,
    input: SlackActorInput,
  ): Promise<TrustedActor> {
    const member = await this.repository.findMemberBySlackUserId(
      scope,
      input.externalUserId,
    );
    if (!member || !member.active) {
      throw new StandupDomainError(
        'EXTERNAL_ACTOR_NOT_LINKED',
        'Slack user is not linked to an active roster member',
      );
    }

    return {
      memberId: member.id,
      externalActorId: input.externalUserId,
      source: 'slack',
    };
  }
}
