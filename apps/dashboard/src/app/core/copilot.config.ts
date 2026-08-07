import type {
  CopilotKitConfig,
  StaticSuggestionsConfig,
} from '@copilotkit/angular';
import { STANDUP_DASHBOARD_AGENT_ID } from '@standup-pulse/shared-contracts';

export const STANDUP_VISUAL_SUGGESTIONS = {
  consumerAgentId: STANDUP_DASHBOARD_AGENT_ID,
  available: 'before-first-message',
  suggestions: [
    {
      title: 'Team pulse',
      message: "Show today's team pulse visually.",
    },
    {
      title: 'Missing updates',
      message: "Show who has not posted today's standup visually.",
    },
    {
      title: 'Current blockers',
      message: 'Show the current blockers and their owners visually.',
    },
    {
      title: 'Interactive pulse',
      message:
        "Create a bespoke interactive dashboard for today's participation.",
    },
  ],
} satisfies StaticSuggestionsConfig;

export const STANDUP_COPILOT_CONFIG = {
  runtimeUrl: '/api/copilotkit',
  defaultToolRendering: true,
  suggestionsConfig: [STANDUP_VISUAL_SUGGESTIONS],
  a2ui: {
    includeSchema: true,
    recovery: {
      showAfterMs: 1_200,
      showAfterAttempts: 2,
      debugExposure: 'hidden',
    },
  },
  openGenerativeUI: {},
} satisfies CopilotKitConfig;
