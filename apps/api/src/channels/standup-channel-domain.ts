import type {
  BlockerDigestViewModel,
  StandupReceiptViewModel,
  SubmitStandupInput,
  TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';

export interface TrustedChannelActor {
  readonly platform: 'slack';
  readonly providerActorId: string;
  readonly sourceMessageId: string;
  readonly sourceEventId?: string;
}

/** The application operations exposed to model-controlled Channel tools. */
export interface StandupChannelDomain {
  submitStandup(
    actor: TrustedChannelActor,
    input: SubmitStandupInput,
  ): Promise<StandupReceiptViewModel | null>;
  getTeamPulse(): Promise<TeamPulseViewModel>;
  getBlockerDigest(): Promise<BlockerDigestViewModel>;
}
