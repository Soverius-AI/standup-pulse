import { createStandupChannel } from './standup-channels';

describe('Standup Channel', () => {
  it('requires the exact managed Channel name', () => {
    expect(() =>
      createStandupChannel({ name: ' ', agent: {} as never }),
    ).toThrow('A managed Channel name is required.');
  });
});
