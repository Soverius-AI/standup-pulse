import {
  STANDUP_COPILOT_CONFIG,
  STANDUP_VISUAL_SUGGESTIONS,
} from './copilot.config';

describe('Standup Copilot visual examples', () => {
  it('offers intent-only visual examples to the dashboard agent', () => {
    expect(STANDUP_VISUAL_SUGGESTIONS).toMatchObject({
      consumerAgentId: 'standupDashboard',
      available: 'before-first-message',
    });
    expect(STANDUP_VISUAL_SUGGESTIONS.suggestions).toEqual([
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
    ]);
    expect(
      STANDUP_VISUAL_SUGGESTIONS.suggestions.map(({ message }) => message),
    ).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /render_a2ui|renderStandup|renderBlocker|card|chart|layout|html|css/i,
        ),
      ]),
    );
  });

  it('configures A2UI without an application-owned UI renderer', () => {
    expect(STANDUP_COPILOT_CONFIG.a2ui).toMatchObject({
      includeSchema: true,
    });
    expect(STANDUP_COPILOT_CONFIG.openGenerativeUI).toEqual({});
    expect(STANDUP_COPILOT_CONFIG.suggestionsConfig).toEqual([
      STANDUP_VISUAL_SUGGESTIONS,
    ]);
  });
});
