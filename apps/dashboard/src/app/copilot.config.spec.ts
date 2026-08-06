import {
  STANDUP_COPILOT_CONFIG,
  STANDUP_VISUAL_SUGGESTIONS,
} from './copilot.config';

describe('Standup Copilot visual examples', () => {
  it('offers deterministic A2UI examples and an Open Generative UI example', () => {
    expect(STANDUP_VISUAL_SUGGESTIONS).toMatchObject({
      consumerAgentId: 'standupPulse',
      available: 'before-first-message',
    });
    expect(STANDUP_VISUAL_SUGGESTIONS.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringContaining('A2UI'),
          message: expect.stringContaining('renderMissingStandups'),
        }),
        expect.objectContaining({
          title: expect.stringContaining('A2UI'),
          message: expect.stringContaining('renderBlockerDigest'),
        }),
        expect.objectContaining({
          title: expect.stringContaining('Generative UI'),
          message: expect.stringContaining('renderStandupWhatIf'),
        }),
        expect.objectContaining({
          title: expect.stringContaining('Open Gen UI'),
          message: expect.stringContaining('Open Generative UI showcase'),
        }),
      ]),
    );
  });

  it('enables Open Generative UI with drawer-specific design guidance', () => {
    expect(STANDUP_COPILOT_CONFIG.openGenerativeUI?.designSkill).toContain(
      'narrow chat drawer',
    );
    expect(STANDUP_COPILOT_CONFIG.suggestionsConfig).toEqual([
      STANDUP_VISUAL_SUGGESTIONS,
    ]);
  });
});
