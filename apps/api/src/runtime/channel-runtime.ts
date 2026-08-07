import { getLocalAgent } from '@ag-ui/mastra';
import type { Mastra } from '@mastra/core';
import {
  CopilotKitIntelligence,
  CopilotRuntime,
  createCopilotRuntimeHandler,
  type CopilotRuntimeFetchHandler,
} from '@copilotkit/runtime/v2';
import { STANDUP_PULSE_AGENT_ID } from '../agent';
import { createStandupChannel } from '../channels';
import { requiredEnv } from '../config/env';
import type { TrustedActorResolver } from '../data';
import type { StandupService } from '../domain';
import { trustedRequestContext } from './request-context';
import { mapChannelStatus, type ExternalRuntimeStatus } from './runtime-status';
import { StandupChannelDomainAdapter } from './standup-channel-domain-adapter';

export interface ManagedChannelRuntime {
  status(): ExternalRuntimeStatus['channel'];
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface ManagedChannelRuntimeOptions {
  channelName: string;
  mastra: Mastra;
  service: StandupService;
  actorResolver: TrustedActorResolver;
  timeZone: string;
  environment: Record<string, string | undefined>;
}

export function createManagedChannelRuntime({
  channelName,
  mastra,
  service,
  actorResolver,
  timeZone,
  environment,
}: ManagedChannelRuntimeOptions): ManagedChannelRuntime {
  const channel = createStandupChannel({
    name: channelName,
    domain: new StandupChannelDomainAdapter(service, actorResolver),
    agent: (threadId) =>
      getLocalAgent({
        mastra,
        agentId: STANDUP_PULSE_AGENT_ID,
        resourceId: `channel:${threadId}`,
        requestContext: trustedRequestContext(
          'channel-readonly',
          timeZone,
          threadId,
        ),
      }),
  });

  const runtime = new CopilotRuntime({
    agents: {},
    intelligence: new CopilotKitIntelligence({
      apiKey: requiredEnv(environment, 'INTELLIGENCE_API_KEY'),
      apiUrl: requiredEnv(environment, 'INTELLIGENCE_API_URL'),
      wsUrl: requiredEnv(environment, 'INTELLIGENCE_GATEWAY_WS_URL'),
    }),
    channels: [channel] as const,
  });

  const handler = createCopilotRuntimeHandler({
    runtime,
    basePath: '/api/channel-runtime',
  });

  return new CopilotManagedChannelRuntime(handler, channelName);
}

class CopilotManagedChannelRuntime implements ManagedChannelRuntime {
  constructor(
    private readonly handler: CopilotRuntimeFetchHandler,
    private readonly channelName: string,
  ) {}

  status(): ExternalRuntimeStatus['channel'] {
    const channels = this.handler.channels;
    if (!channels) return { state: 'offline', name: this.channelName };
    return mapChannelStatus(this.channelName, channels.status());
  }

  async start(): Promise<void> {
    const channels = this.handler.channels;
    if (!channels) {
      throw new Error('Managed Channel lifecycle is unavailable.');
    }

    await channels.ready({ timeoutMs: 30_000 });
    const status = channels.status();
    if (
      status.overall !== 'online' ||
      status.channels[this.channelName] !== 'online'
    ) {
      throw new Error(
        `Managed Channel did not become online (overall=${status.overall}, channel=${status.channels[this.channelName] ?? 'missing'}).`,
      );
    }
  }

  async stop(): Promise<void> {
    await this.handler.channels?.stop();
  }
}
