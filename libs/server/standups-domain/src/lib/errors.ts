export type StandupDomainErrorCode =
  | 'TEAM_NOT_FOUND'
  | 'MEMBER_NOT_FOUND'
  | 'ACTOR_NOT_IN_TEAM'
  | 'EXTERNAL_ACTOR_NOT_LINKED'
  | 'INVALID_TIME_ZONE'
  | 'PROACTIVE_DELIVERY_UNAVAILABLE';

export class StandupDomainError extends Error {
  constructor(
    readonly code: StandupDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'StandupDomainError';
  }
}
