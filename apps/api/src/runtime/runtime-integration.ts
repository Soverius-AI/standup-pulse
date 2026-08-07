import { getLocalAgents } from '@ag-ui/mastra';
import { Mastra } from '@mastra/core';
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
  type AgentsConfig,
  type CopilotRuntimeFetchHandler,
} from '@copilotkit/runtime/v2';
import {
  createStandupMastraInfrastructure,
  createLocalGemmaModel,
  createStandupPulseAgent,
  loadLocalModelConfig,
  STANDUP_PULSE_AGENT_ID,
} from '../agent';
import { FIXTURE_MEMBER_IDS, type TrustedActorResolver } from '../data';
import type { StandupService } from '../domain';
import { STANDUP_DASHBOARD_AGENT_ID } from '@standup-pulse/shared-contracts';
import {
  DASHBOARD_MASTRA_A2UI_CONFIG,
  DASHBOARD_RUNTIME_MIDDLEWARE_CONFIG,
} from '../config/dashboard-runtime.config';
import {
  createManagedChannelRuntime,
  type ManagedChannelRuntime,
} from './channel-runtime';
import { DomainReadService } from './domain-read-service';
import { modelIsReady } from './model-readiness';
import { trustedRequestContext } from './request-context';
import type { ExternalRuntimeStatus } from './runtime-status';
import { withA2UIActivityOnlyRendering } from './a2ui-event-filter';

const LOCAL_ADMIN_ID = 'standup-pulse-local-admin';

type LocalModelConfig = ReturnType<typeof loadLocalModelConfig>;

export interface RuntimeIntegrationOptions {
  channelName: string;
  service: StandupService;
  actorResolver: TrustedActorResolver;
  environment?: Record<string, string | undefined>;
}

export interface RuntimeIntegration {
  copilotHandler: CopilotRuntimeFetchHandler;
  runtimeStatus(): Promise<ExternalRuntimeStatus>;
  startChannels(): Promise<void>;
  stopChannels(): Promise<void>;
}

export function createDashboardRuntime(agents: AgentsConfig): CopilotRuntime {
  return new CopilotRuntime({
    agents,
    runner: new InMemoryAgentRunner(),
    ...DASHBOARD_RUNTIME_MIDDLEWARE_CONFIG,
  });
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

  const dashboardMastra = await buildMastra(
    'standup-pulse-api-dashboard',
    createStandupPulseAgent({
      model,
      readService,
      a2ui: DASHBOARD_MASTRA_A2UI_CONFIG,
    }),
  );
  const channelMastra = await buildMastra(
    'standup-pulse-api-channel',
    createStandupPulseAgent({
      model,
      readService,
      includePersonalTools: false,
    }),
  );

  const channelRuntime = createManagedChannelRuntime({
    channelName,
    mastra: channelMastra,
    service,
    actorResolver,
    timeZone: team.timeZone,
    environment,
  });

  const dashboardRuntime = createDashboardRuntime(() =>
    dashboardAgents(dashboardMastra, team.timeZone),
  );
  const copilotHandler = createCopilotRuntimeHandler({
    runtime: dashboardRuntime,
    basePath: '/api/copilotkit',
  });

  return new ManagedRuntimeIntegration(
    copilotHandler,
    channelRuntime,
    modelConfig,
  );
}

class ManagedRuntimeIntegration implements RuntimeIntegration {
  constructor(
    readonly copilotHandler: CopilotRuntimeFetchHandler,
    private readonly channelRuntime: ManagedChannelRuntime,
    private readonly modelConfig: LocalModelConfig,
  ) {}

  async runtimeStatus(): Promise<ExternalRuntimeStatus> {
    const modelReady = await modelIsReady(
      this.modelConfig.baseUrl,
      this.modelConfig.modelId,
      this.modelConfig.contextSize,
    );
    return {
      model: modelReady
        ? { state: 'online', modelId: this.modelConfig.modelId }
        : {
            state: 'degraded',
            modelId: this.modelConfig.modelId,
            message: 'Local llama.cpp model is not ready',
          },
      agent: modelReady
        ? { state: 'online' }
        : {
            state: 'degraded',
            message: 'Agent is waiting for the local model',
          },
      channel: this.channelRuntime.status(),
    };
  }

  async startChannels(): Promise<void> {
    await this.channelRuntime.start();
  }

  async stopChannels(): Promise<void> {
    await this.channelRuntime.stop();
  }
}

async function buildMastra(
  serviceName: string,
  agent: ReturnType<typeof createStandupPulseAgent>,
): Promise<Mastra> {
  const infrastructure = await createStandupMastraInfrastructure({
    serviceName,
  });
  return new Mastra({
    agents: { [STANDUP_PULSE_AGENT_ID]: agent },
    ...infrastructure,
    logger: false,
  });
}

function dashboardAgents(mastra: Mastra, timeZone: string) {
  const agent = getLocalAgents({
    mastra,
    resourceId: LOCAL_ADMIN_ID,
    requestContext: trustedRequestContext(FIXTURE_MEMBER_IDS.ada, timeZone),
  })[STANDUP_PULSE_AGENT_ID];
  if (!agent) throw new Error('Standup Pulse dashboard agent is unavailable.');

  return {
    [STANDUP_DASHBOARD_AGENT_ID]: withA2UIActivityOnlyRendering(agent),
  };
}
