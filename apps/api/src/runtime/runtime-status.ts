import type { ChannelStatus } from '@copilotkit/runtime/v2';
import type { StatusResponse } from '@standup-pulse/shared-contracts';

export type ExternalRuntimeStatus = Pick<
  StatusResponse,
  'model' | 'agent' | 'channel'
>;

export function mapChannelStatus(
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
