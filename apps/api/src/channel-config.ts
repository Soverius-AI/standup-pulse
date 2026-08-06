import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const ChannelsConfigSchema = z
  .object({
    version: z.literal(1),
    channels: z
      .array(
        z
          .object({
            name: z.string().trim().min(1),
            providers: z.object({ slack: z.unknown() }).passthrough(),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

export function loadDeclaredSlackChannelName(
  workspaceRoot = process.cwd(),
): string {
  const configPath = resolve(workspaceRoot, '.copilotkit/channels.json');
  const parsed = ChannelsConfigSchema.parse(
    JSON.parse(readFileSync(configPath, 'utf8')),
  );
  const channel = parsed.channels.find(({ providers }) =>
    Object.hasOwn(providers, 'slack'),
  );
  if (!channel) {
    throw new Error(
      'No Slack Channel is declared in .copilotkit/channels.json',
    );
  }
  return channel.name;
}
