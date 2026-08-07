import { mapChannelStatus } from './runtime-status';

describe('mapChannelStatus', () => {
  it('reports online when the named channel is online', () => {
    expect(
      mapChannelStatus('standup', {
        overall: 'online',
        channels: { standup: 'online' },
      }),
    ).toEqual({ state: 'online', name: 'standup' });
  });

  it('reports offline for stopped or errored channels', () => {
    expect(
      mapChannelStatus('standup', {
        overall: 'online',
        channels: { standup: 'error' },
      }),
    ).toEqual({
      state: 'offline',
      name: 'standup',
      message: 'Channel is error',
    });
    expect(
      mapChannelStatus('standup', {
        overall: 'online',
        channels: { standup: 'stopped' },
      }),
    ).toEqual({
      state: 'offline',
      name: 'standup',
      message: 'Channel is stopped',
    });
  });

  it('reports degraded while connecting', () => {
    expect(
      mapChannelStatus('standup', {
        overall: 'online',
        channels: { standup: 'connecting' },
      }),
    ).toEqual({
      state: 'degraded',
      name: 'standup',
      message: 'Channel is connecting',
    });
  });

  it('falls back to the overall status for an unknown channel name', () => {
    expect(
      mapChannelStatus('standup', { overall: 'reconnecting', channels: {} }),
    ).toEqual({
      state: 'degraded',
      name: 'standup',
      message: 'Channel is reconnecting',
    });
  });
});
