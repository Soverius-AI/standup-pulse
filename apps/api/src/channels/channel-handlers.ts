import type { ChannelHandler } from '@copilotkit/channels';

export const CHANNEL_FAILURE_REPLY =
  'I could not process that update just now. Please try again in this thread.';

type TriggerKind = 'mention' | 'subscribed_message';

export interface ChannelLogger {
  error(
    event: 'channel_agent_run_failed',
    context: { trigger: TriggerKind },
  ): void;
}

export const defaultChannelLogger: ChannelLogger = {
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
        // No further fallback can be delivered on this thread.
      }
    }
  };
};

export const createMentionHandler = (
  logger: ChannelLogger = defaultChannelLogger,
): ChannelHandler =>
  withFailureReply('mention', logger, async (context) => {
    await context.thread.subscribe();
    await runAgent(context);
  });

export const createSubscribedMessageHandler = (
  logger: ChannelLogger = defaultChannelLogger,
): ChannelHandler =>
  withFailureReply('subscribed_message', logger, async (context) => {
    if (await context.thread.isSubscribed()) {
      await runAgent(context);
    }
  });
