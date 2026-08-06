import { defineChannelTool, type ChannelTool } from '@copilotkit/channels';
import type {
  BlockerDigestViewModel,
  StandupReceiptViewModel,
  SubmitStandupInput,
  TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';
import { SubmitStandupInputSchema } from '@standup-pulse/shared-contracts';
import { z } from 'zod';
import {
  BlockerDigestCard,
  StandupReceiptCard,
  TeamPulseCard,
  TeamPulseChart,
} from './pulse-components';

export interface TrustedChannelActor {
  platform: string;
  providerActorId: string;
  sourceMessageId: string;
  sourceEventId?: string;
}

export interface StandupChannelDomain {
  submitStandup(
    actor: TrustedChannelActor,
    input: SubmitStandupInput,
  ): Promise<StandupReceiptViewModel | null>;
  getTeamPulse(date?: string): Promise<TeamPulseViewModel>;
  getBlockerDigest(date?: string): Promise<BlockerDigestViewModel>;
}

const currentDateSchema = z.object({}).strict();

export function createStandupChannelTools(
  domain: StandupChannelDomain,
): ChannelTool[] {
  const submitStandup = defineChannelTool({
    name: 'submitStandup',
    description:
      'Record yesterday, today, and blockers for the authenticated Slack member. Identity and work date come from trusted Channel context.',
    parameters: SubmitStandupInputSchema,
    async handler(input, context) {
      const message = context.message;
      if (!message || context.actor.kind !== 'human') {
        return 'A human Slack message is required to record a standup.';
      }

      const receipt = await domain.submitStandup(
        {
          platform: context.platform,
          providerActorId: context.actor.id,
          sourceMessageId:
            message.operation?.logicalMessageId ?? message.ref.id,
          sourceEventId: message.eventId,
        },
        input,
      );

      if (!receipt) {
        await context.thread.post(
          'I could not match your Slack account to an active roster member. Ask an admin to link it in Standup Pulse.',
        );
        return 'The authenticated Slack actor is not linked to an active roster member; nothing was stored.';
      }

      await context.thread.post(<StandupReceiptCard receipt={receipt} />);
      return `Recorded ${receipt.member.displayName}'s standup for ${receipt.date} with ${receipt.blockerCount} blocker(s).`;
    },
  });

  const renderTeamPulse = defineChannelTool({
    name: 'renderTeamPulse',
    description:
      "Render the stored team standup summary and participation chart for today's trusted work date. Use this for team pulse, participation, missing-update, or trend questions.",
    parameters: currentDateSchema,
    async handler(_input, { platform, thread }) {
      const pulse = await domain.getTeamPulse();
      await thread.post(<TeamPulseCard pulse={pulse} />);
      if (platform === 'slack' && pulse.trend.length) {
        await thread.post(<TeamPulseChart pulse={pulse} />);
      }
      return `Displayed the stored team pulse and participation trend for ${pulse.date}.`;
    },
  });

  const renderBlockerDigest = defineChannelTool({
    name: 'renderBlockerDigest',
    description:
      "Render the stored blocker digest for today's trusted work date. Never invent blockers or a date.",
    parameters: currentDateSchema,
    async handler(_input, { thread }) {
      const digest = await domain.getBlockerDigest();
      await thread.post(<BlockerDigestCard digest={digest} />);
      return `Displayed the stored blocker digest for ${digest.date}.`;
    },
  });

  return [submitStandup, renderTeamPulse, renderBlockerDigest];
}
