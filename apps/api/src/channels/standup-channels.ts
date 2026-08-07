import { createChannel, type Channel } from '@copilotkit/channels';
import type { StandupChannelDomain } from './standup-channel-domain';
import {
  createMentionHandler,
  createSubscribedMessageHandler,
  defaultChannelLogger,
  type ChannelLogger,
} from './channel-handlers';
import { createStandupChannelTools } from './standup-tools';

export interface StandupChannelOptions {
  name: string;
  agent: NonNullable<Parameters<typeof createChannel>[0]['agent']>;
  domain?: StandupChannelDomain;
  logger?: ChannelLogger;
}

export function createStandupChannel({
  name,
  agent,
  domain,
  logger = defaultChannelLogger,
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
