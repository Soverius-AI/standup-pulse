import { getLocalAgent, getLocalAgents } from '@ag-ui/mastra';
import { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import {
  CopilotKitIntelligence,
  CopilotRuntime,
  type ChannelStatus,
} from '@copilotkit/runtime/v2';
import {
  createCopilotHonoHandler,
  type CopilotHonoApp,
} from '@copilotkit/runtime/v2/hono';
import {
  createStandupDashboardAgent,
  createLocalGemmaModel,
  createStandupPulseAgent,
  loadLocalModelConfig,
  STANDUP_PULSE_AGENT_ID,
  type BlockerView,
  type MyStandupView,
  type StandupPulseReadService,
  type TrustedAgentContext,
} from '@standup-pulse/standup-agent';
import {
  createStandupChannel,
  type StandupChannelDomain,
  type TrustedChannelActor,
} from '@standup-pulse/standup-channels';
import {
  DEFAULT_TEAM_SCOPE,
  FIXTURE_MEMBER_IDS,
  type TrustedActorResolver,
} from '@standup-pulse/standups-data';
import {
  getLocalDate,
  StandupDomainError,
  type StandupService,
} from '@standup-pulse/standups-domain';
import {
  BASIC_A2UI_CATALOG_ID,
  type BlockerDigestViewModel,
  type StandupReceiptViewModel,
  type SubmitStandupInput,
  type TeamPulseViewModel,
} from '@standup-pulse/shared-contracts';
import type { ExternalRuntimeStatus } from './app';

const LOCAL_ADMIN_ID = 'standup-pulse-local-admin';

export interface RuntimeIntegrationOptions {
  channelName: string;
  service: StandupService;
  actorResolver: TrustedActorResolver;
  environment?: Record<string, string | undefined>;
}

export interface RuntimeIntegration {
  copilotApp: CopilotHonoApp;
  runtimeStatus(): Promise<ExternalRuntimeStatus>;
  startChannels(): Promise<void>;
  stopChannels(): Promise<void>;
}

class DomainReadService implements StandupPulseReadService {
  constructor(private readonly service: StandupService) {}

  async getMyStandup(
    context: TrustedAgentContext,
    input: { readonly localDate?: string },
  ): Promise<MyStandupView | null> {
    const pulse = await this.getTeamPulse(context, input);
    const standup = pulse.standups.find(
      ({ memberId }) => memberId === context.actorId,
    );
    if (!standup) return null;

    return {
      localDate: pulse.date,
      submitted: standup.status !== 'missing',
      ...(standup.preview ? { today: standup.preview } : {}),
      blockers: pulse.blockers
        .filter(({ owner }) => owner.memberId === context.actorId)
        .map(({ title }) => title),
    };
  }

  async getTeamPulse(
    _context: TrustedAgentContext,
    input: { readonly localDate?: string },
  ): Promise<TeamPulseViewModel> {
    const team = await this.service.getTeam();
    const date = input.localDate ?? getLocalDate(new Date(), team.timeZone);
    return this.service.getTeamPulse(date);
  }

  async listBlockers(
    context: TrustedAgentContext,
    input: { readonly status?: 'open' | 'resolved'; readonly limit?: number },
  ): Promise<readonly BlockerView[]> {
    if (input.status === 'resolved') return [];
    const pulse = await this.getTeamPulse(context, {});
    return pulse.blockers.slice(0, input.limit ?? 100).map((blocker) => ({
      id: blocker.id,
      summary: blocker.title,
      ownerDisplayName: blocker.owner.displayName,
      status: 'open',
      ageDays: blocker.ageDays,
    }));
  }
}

class ChannelDomainAdapter implements StandupChannelDomain {
  constructor(
    private readonly service: StandupService,
    private readonly actorResolver: TrustedActorResolver,
  ) {}

  async submitStandup(
    actor: TrustedChannelActor,
    input: SubmitStandupInput,
  ): Promise<StandupReceiptViewModel | null> {
    try {
      const trustedActor = await this.actorResolver.resolveSlackActor(
        DEFAULT_TEAM_SCOPE,
        { externalUserId: actor.providerActorId },
      );
      return this.service.submitStandup(trustedActor, input, {
        source: 'slack',
        sourceMessageId: actor.sourceMessageId,
      });
    } catch (error) {
      if (
        error instanceof StandupDomainError &&
        error.code === 'EXTERNAL_ACTOR_NOT_LINKED'
      ) {
        return null;
      }
      throw error;
    }
  }

  async getTeamPulse(date?: string): Promise<TeamPulseViewModel> {
    const team = await this.service.getTeam();
    return this.service.getTeamPulse(
      date ?? getLocalDate(new Date(), team.timeZone),
    );
  }

  async getBlockerDigest(date?: string): Promise<BlockerDigestViewModel> {
    const pulse = await this.getTeamPulse(date);
    return {
      team: pulse.team,
      date: pulse.date,
      blockers: pulse.blockers,
    };
  }
}

function trustedRequestContext(
  actorId: string,
  timeZone: string,
  threadId?: string,
): RequestContext {
  const entries: Array<[string, string]> = [
    ['actorId', actorId],
    ['teamId', DEFAULT_TEAM_SCOPE.teamId],
    ['timezone', timeZone],
  ];
  if (threadId) entries.push(['threadId', threadId]);
  return new RequestContext(entries);
}

function requiredEnvironment(
  environment: Record<string, string | undefined>,
  name: string,
): string {
  const value = environment[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function mapChannelStatus(
  channelName: string,
  status: { overall: ChannelStatus; channels: Record<string, ChannelStatus> },
): ExternalRuntimeStatus['channel'] {
  const state = status.channels[channelName] ?? status.overall;
  if (state === 'online') return { state: 'online', name: channelName };
  if (state === 'error' || state === 'stopped') {
    return {
      state: 'offline',
      name: channelName,
      message: `Channel is ${state}`,
    };
  }
  return {
    state: 'degraded',
    name: channelName,
    message: `Channel is ${state}`,
  };
}

async function modelIsReady(
  baseUrl: string,
  modelId: string,
): Promise<boolean> {
  try {
    const serverRoot = new URL(baseUrl);
    serverRoot.pathname = serverRoot.pathname.replace(/\/v1\/?$/, '/');
    const [healthResponse, modelsResponse] = await Promise.all([
      fetch(new URL('health', serverRoot), {
        signal: AbortSignal.timeout(1_500),
      }),
      fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        signal: AbortSignal.timeout(1_500),
      }),
    ]);
    if (!healthResponse.ok || !modelsResponse.ok) return false;
    const models = (await modelsResponse.json()) as {
      data?: Array<{ id?: string }>;
    };
    return Boolean(models.data?.some(({ id }) => id === modelId));
  } catch {
    return false;
  }
}

export async function createRuntimeIntegration({
  channelName,
  service,
  actorResolver,
  environment = process.env,
}: RuntimeIntegrationOptions): Promise<RuntimeIntegration> {
  const team = await service.getTeam();
  const modelConfig = loadLocalModelConfig(environment);
  const model = createLocalGemmaModel(modelConfig);
  const readService = new DomainReadService(service);
  const agent = createStandupPulseAgent({ model, readService });
  const mastra = new Mastra({
    agents: { [STANDUP_PULSE_AGENT_ID]: agent },
    logger: false,
  });

  const channel = createStandupChannel({
    name: channelName,
    domain: new ChannelDomainAdapter(service, actorResolver),
    agent: (threadId) =>
      getLocalAgent({
        mastra,
        agentId: STANDUP_PULSE_AGENT_ID,
        resourceId: `channel:${threadId}`,
        requestContext: trustedRequestContext(
          'channel-readonly',
          team.timeZone,
          threadId,
        ),
      }),
  });

  const intelligence = new CopilotKitIntelligence({
    apiKey: requiredEnvironment(environment, 'INTELLIGENCE_API_KEY'),
    apiUrl: requiredEnvironment(environment, 'INTELLIGENCE_API_URL'),
    wsUrl: requiredEnvironment(environment, 'INTELLIGENCE_GATEWAY_WS_URL'),
  });

  const runtime = new CopilotRuntime({
    agents: () => {
      const dashboardAgents = getLocalAgents({
        mastra,
        resourceId: LOCAL_ADMIN_ID,
        requestContext: trustedRequestContext(
          FIXTURE_MEMBER_IDS.ada,
          team.timeZone,
        ),
      });
      const fallbackAgent = dashboardAgents[STANDUP_PULSE_AGENT_ID];
      if (!fallbackAgent) {
        throw new Error('Standup Pulse dashboard agent is unavailable.');
      }
      return {
        ...dashboardAgents,
        [STANDUP_PULSE_AGENT_ID]: createStandupDashboardAgent({
          fallbackAgent,
          modelConfig,
          getTeamPulse: () =>
            readService.getTeamPulse(
              {
                actorId: FIXTURE_MEMBER_IDS.ada,
                teamId: DEFAULT_TEAM_SCOPE.teamId,
                timezone: team.timeZone,
              },
              {},
            ),
        }),
      };
    },
    intelligence,
    identifyUser: () => ({ id: LOCAL_ADMIN_ID, name: 'Local Admin' }),
    channels: [channel] as const,
    a2ui: {
      enabled: true,
      injectA2UITool: false,
      defaultCatalogId: BASIC_A2UI_CATALOG_ID,
      recovery: { debugExposure: 'hidden' },
    },
  });
  const copilotApp = createCopilotHonoHandler({
    runtime,
    basePath: '/api/copilotkit',
  });

  return {
    copilotApp,
    async runtimeStatus() {
      const modelReady = await modelIsReady(
        modelConfig.baseUrl,
        modelConfig.modelId,
      );
      return {
        model: modelReady
          ? { state: 'online', modelId: modelConfig.modelId }
          : {
              state: 'degraded',
              modelId: modelConfig.modelId,
              message: 'Local llama.cpp model is not ready',
            },
        agent: modelReady
          ? { state: 'online' }
          : {
              state: 'degraded',
              message: 'Agent is waiting for the local model',
            },
        channel: copilotApp.channels
          ? mapChannelStatus(channelName, copilotApp.channels.status())
          : { state: 'offline', name: channelName },
      };
    },
    async startChannels() {
      if (!copilotApp.channels) {
        throw new Error('Managed Channel lifecycle is unavailable.');
      }
      await copilotApp.channels.ready({ timeoutMs: 30_000 });
      const status = copilotApp.channels.status();
      if (
        status.overall !== 'online' ||
        status.channels[channelName] !== 'online'
      ) {
        throw new Error(
          `Managed Channel did not become online (overall=${status.overall}, channel=${status.channels[channelName] ?? 'missing'}).`,
        );
      }
    },
    async stopChannels() {
      await copilotApp.channels?.stop();
    },
  };
}
