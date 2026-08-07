import {
  BASIC_A2UI_CATALOG_ID,
  STANDUP_DASHBOARD_AGENT_ID,
} from '@standup-pulse/shared-contracts';
import {
  DASHBOARD_MASTRA_A2UI_CONFIG,
  DASHBOARD_RUNTIME_MIDDLEWARE_CONFIG,
} from './dashboard-runtime.config';

describe('dashboard runtime middleware', () => {
  it('enables model-authored A2UI and Open Generative UI for the dashboard', () => {
    expect(DASHBOARD_RUNTIME_MIDDLEWARE_CONFIG.a2ui).toEqual({
      enabled: true,
      agents: [STANDUP_DASHBOARD_AGENT_ID],
      injectA2UITool: false,
      defaultCatalogId: BASIC_A2UI_CATALOG_ID,
      recovery: { debugExposure: 'hidden', maxAttempts: 1 },
    });
    expect(DASHBOARD_RUNTIME_MIDDLEWARE_CONFIG.openGenerativeUI).toEqual({
      agents: [STANDUP_DASHBOARD_AGENT_ID],
    });
  });

  it('uses the shared A2UI catalog without prescribing a fixed layout', () => {
    expect(DASHBOARD_MASTRA_A2UI_CONFIG).toEqual({
      defaultCatalogId: BASIC_A2UI_CATALOG_ID,
      guidelines: {
        designGuidelines: expect.stringContaining(
          'any components from the provided Basic Catalog',
        ),
      },
      recovery: { maxAttempts: 1 },
    });
  });
});
