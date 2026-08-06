import type {
  CopilotKitConfig,
  StaticSuggestionsConfig,
} from '@copilotkit/angular';

export const STANDUP_VISUAL_SUGGESTIONS = {
  consumerAgentId: 'standupPulse',
  available: 'before-first-message',
  suggestions: [
    {
      title: 'A2UI · Missing updates',
      message:
        "Render today's missing standups as a visual card. You must call the renderMissingStandups tool and display its A2UI result.",
    },
    {
      title: 'A2UI · Blocker digest',
      message:
        "Render today's blocker digest visually. You must call the renderBlockerDigest tool and display its A2UI result.",
    },
    {
      title: 'Generative UI · What-if',
      message:
        'Call renderStandupWhatIf with total 5, posted 3, and blockers 1. You must use that exact Generative UI tool and not answer with only text.',
    },
    {
      title: 'Open Gen UI · Pulse chart',
      message:
        'Open Generative UI showcase: build an interactive view of today’s team pulse with KPI cards, a seven-day participation chart, missing updates, blocker priorities, and working member filters.',
    },
  ],
} satisfies StaticSuggestionsConfig;

export const STANDUP_COPILOT_CONFIG = {
  runtimeUrl: '/api/copilotkit',
  defaultToolRendering: true,
  suggestionsConfig: [STANDUP_VISUAL_SUGGESTIONS],
  a2ui: {
    includeSchema: false,
    recovery: {
      showAfterMs: 1_200,
      showAfterAttempts: 2,
      debugExposure: 'hidden',
    },
  },
  openGenerativeUI: {
    designSkill: `Build a compact, responsive Standup Pulse interface for a narrow chat drawer.
Use an off-white surface, dark navy text, amber for attention, red only for blockers, and green for healthy states.
Use accessible KPI cards, concise labels, and CSS-based charts that remain readable without horizontal scrolling.
Keep interactions keyboard accessible and never load external scripts, fonts, images, or credentials.
Hard limit: keep the combined generated HTML, CSS, and JavaScript under 2,400 characters. Prefer one focused interaction over a large dashboard.`,
  },
} satisfies CopilotKitConfig;
