import type { A2UIInjectConfig } from '@ag-ui/mastra';
import type { CopilotRuntimeOptions } from '@copilotkit/runtime/v2';
import {
  BASIC_A2UI_CATALOG_ID,
  STANDUP_DASHBOARD_AGENT_ID,
} from '@standup-pulse/shared-contracts';

const DASHBOARD_A2UI_MAX_ATTEMPTS = 1;

export const DASHBOARD_RUNTIME_MIDDLEWARE_CONFIG = {
  a2ui: {
    enabled: true,
    agents: [STANDUP_DASHBOARD_AGENT_ID],
    injectA2UITool: false,
    defaultCatalogId: BASIC_A2UI_CATALOG_ID,
    recovery: {
      debugExposure: 'hidden',
      maxAttempts: DASHBOARD_A2UI_MAX_ATTEMPTS,
    },
  },
  openGenerativeUI: {
    agents: [STANDUP_DASHBOARD_AGENT_ID],
  },
} satisfies Pick<CopilotRuntimeOptions, 'a2ui' | 'openGenerativeUI'>;

export const DASHBOARD_MASTRA_A2UI_CONFIG = {
  defaultCatalogId: BASIC_A2UI_CATALOG_ID,
  guidelines: {
    designGuidelines:
      'Choose the layout and any components from the provided Basic Catalog that best answer the request. Do not default to a fixed card template. Keep the result usable in the roughly 380px-wide chat panel. Use only facts from the conversation and tool results, do not invent media URLs, and add interactive controls only when useful for the request.',
  },
  recovery: { maxAttempts: 1 },
} satisfies A2UIInjectConfig;
