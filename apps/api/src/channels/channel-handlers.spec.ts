import type { ChannelHandler } from '@copilotkit/channels';
import {
  CHANNEL_FAILURE_REPLY,
  createMentionHandler,
  createSubscribedMessageHandler,
  type ChannelLogger,
} from './channel-handlers';

const message = {
  text: 'Yesterday I finished the release. Today I am documenting it.',
  user: { id: 'member-1', name: 'Ada' },
  actor: { id: 'U123', kind: 'human' as const, name: 'Ada' },
  ref: { id: 'message-1' },
  platform: 'slack',
  operation: {
    kind: 'created' as const,
    logicalMessageId: 'message-1',
    revisionId: 'message-1',
    mentioned: true,
  },
  contentParts: [{ type: 'text' as const, text: 'structured prompt' }],
};

const setupHandler = (
  subscribed: boolean,
  overrides: Partial<{
    subscribe: () => Promise<void>;
    runAgent: (input?: unknown) => Promise<unknown>;
    post: (value: unknown) => Promise<unknown>;
  }> = {},
) => {
  const events: string[] = [];
  const thread = {
    subscribe: async () => {
      events.push('subscribe');
    },
    isSubscribed: async () => subscribed,
    runAgent: async (input?: unknown) => {
      events.push(`run:${JSON.stringify(input)}`);
      return undefined;
    },
    post: async (value: unknown) => {
      events.push(`post:${String(value)}`);
      return { id: 'reply-1' };
    },
    ...overrides,
  };

  return {
    events,
    context: { thread, message } as unknown as Parameters<ChannelHandler>[0],
  };
};

describe('Channel message handlers', () => {
  it('subscribes before it runs the agent for a mention', async () => {
    const { events, context } = setupHandler(false);

    await createMentionHandler()(context);

    expect(events[0]).toBe('subscribe');
    expect(events[1]).toContain('structured prompt');
  });

  it('runs a follow-up only in an already subscribed conversation', async () => {
    const subscribed = setupHandler(true);
    const fresh = setupHandler(false);

    await createSubscribedMessageHandler()(subscribed.context);
    await createSubscribedMessageHandler()(fresh.context);

    expect(subscribed.events).toHaveLength(1);
    expect(subscribed.events[0]).toContain('run:');
    expect(fresh.events).toHaveLength(0);
  });

  it('logs without message content and attempts one visible failure reply', async () => {
    const errors: Array<{ event: string; context: unknown }> = [];
    const logger: ChannelLogger = {
      error: (event, context) => errors.push({ event, context }),
    };
    const { events, context } = setupHandler(true, {
      runAgent: async () => {
        throw new Error('secret prompt body');
      },
    });

    await createSubscribedMessageHandler(logger)(context);

    expect(errors).toEqual([
      {
        event: 'channel_agent_run_failed',
        context: { trigger: 'subscribed_message' },
      },
    ]);
    expect(JSON.stringify(errors)).not.toContain('secret prompt body');
    expect(events).toEqual([`post:${CHANNEL_FAILURE_REPLY}`]);
  });
});
