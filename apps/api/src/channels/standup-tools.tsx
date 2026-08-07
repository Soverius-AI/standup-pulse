import {
  defineChannelTool,
  type ChannelTool,
  type ChannelToolContext,
} from '@copilotkit/channels';
import { SubmitStandupInputSchema } from '@standup-pulse/shared-contracts';
import { z } from 'zod';
import type {
  StandupChannelDomain,
  TrustedChannelActor,
} from './standup-channel-domain';
import {
  BlockerDigestCard,
  StandupReceiptCard,
  TeamPulseCard,
} from './standup-cards';
import { TeamPulseChart } from './team-pulse-chart';

const currentDateSchema = z.object({}).strict();

type StandupChannelTools = [
  submitStandup: ChannelTool,
  renderTeamPulse: ChannelTool,
  renderBlockerDigest: ChannelTool,
];

export function createStandupChannelTools(
  domain: StandupChannelDomain,
): StandupChannelTools {
  return [
    createSubmitStandupTool(domain),
    createTeamPulseTool(domain),
    createBlockerDigestTool(domain),
  ];
}

function createSubmitStandupTool(domain: StandupChannelDomain): ChannelTool {
  return defineChannelTool({
    name: 'submitStandup',
    description:
      'Record yesterday, today, and blockers for the authenticated Slack member. Identity and work date come from trusted Channel context.',
    parameters: SubmitStandupInputSchema,
    async handler(input, context) {
      const actor = trustedActorFrom(context);
      if (!actor) {
        return 'A human Slack message is required to record a standup.';
      }

      const receipt = await domain.submitStandup(actor, input);

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
}

function createTeamPulseTool(domain: StandupChannelDomain): ChannelTool {
  return defineChannelTool({
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
}

function createBlockerDigestTool(domain: StandupChannelDomain): ChannelTool {
  return defineChannelTool({
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
}

function trustedActorFrom(
  context: ChannelToolContext,
): TrustedChannelActor | null {
  const { actor, message } = context;
  if (!message || actor.kind !== 'human' || context.platform !== 'slack') {
    return null;
  }

  return {
    platform: context.platform,
    providerActorId: actor.id,
    sourceMessageId: message.operation?.logicalMessageId ?? message.ref.id,
    ...(message.eventId ? { sourceEventId: message.eventId } : {}),
  };
}
