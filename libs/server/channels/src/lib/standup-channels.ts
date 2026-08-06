import type { AbstractAgent } from '@ag-ui/client';
import {
  createChannel,
  type Channel,
  type ChannelHandler,
} from '@copilotkit/channels';
import {
  createStandupChannelTools,
  type StandupChannelDomain,
} from './standup-tools';

export const CHANNEL_FAILURE_REPLY =
  'I could not process that update just now. Please try again in this thread.';

export interface ChannelLogger {
  error(
    event: 'channel_agent_run_failed',
    context: { trigger: TriggerKind },
  ): void;
}

export interface StandupChannelOptions {
  name: string;
  agent: AbstractAgent | ((threadId: string) => AbstractAgent);
  domain?: StandupChannelDomain;
  logger?: ChannelLogger;
}

type TriggerKind = 'mention' | 'subscribed_message';

const safeLogger: ChannelLogger = {
  error(event, context) {
    console.error(event, context);
  },
};

const runAgent: ChannelHandler = async ({ thread, message }) => {
  const prompt = message.contentParts?.length
    ? message.contentParts
    : message.text;

  await thread.runAgent({ prompt });
};

const withFailureReply = (
  trigger: TriggerKind,
  logger: ChannelLogger,
  handler: ChannelHandler,
): ChannelHandler => {
  return async (context) => {
    try {
      await handler(context);
    } catch {
      logger.error('channel_agent_run_failed', { trigger });

      try {
        await context.thread.post(CHANNEL_FAILURE_REPLY);
      } catch {
        // A delivery failure is already visible in the Channel lifecycle status.
      }
    }
  };
};

export const createMentionHandler = (
  logger: ChannelLogger = safeLogger,
): ChannelHandler =>
  withFailureReply('mention', logger, async (context) => {
    await context.thread.subscribe();
    await runAgent(context);
  });

export const createSubscribedMessageHandler = (
  logger: ChannelLogger = safeLogger,
): ChannelHandler =>
  withFailureReply('subscribed_message', logger, async (context) => {
    if (await context.thread.isSubscribed()) {
      await runAgent(context);
    }
  });

export function createStandupChannel({
  name,
  agent,
  domain,
  logger = safeLogger,
}: StandupChannelOptions): Channel {
  if (!name.trim()) {
    throw new Error('A managed Channel name is required.');
  }

  const channel = createChannel({
    name,
    identifyUser: 'platform',
    agent,
    tools: domain ? createStandupChannelTools(domain) : [],
    store: { concurrency: 'serial' },
  });

  channel.onMention(createMentionHandler(logger));
  channel.onMessage(createSubscribedMessageHandler(logger));

  return channel;
}
