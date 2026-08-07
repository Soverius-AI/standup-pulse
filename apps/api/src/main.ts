import 'dotenv/config';
import { serve } from '@hono/node-server';
import {
  DailySnapshotScheduler,
  DEFAULT_TEAM_SCOPE,
  SchedulerRunStore,
  seedFixtureData,
  SqliteStandupRepository,
  StandupDatabase,
  TrustedActorResolver,
} from './data';
import { StandupService } from './domain';
import { loadDeclaredSlackChannelName } from './config/channel-config';
import { loadServerConfig } from './config/env';
import { createApiApp } from './http/app';
import { assertLoopbackHostname } from './loopback-host';
import { createRuntimeIntegration } from './runtime/runtime-integration';
import { SlackNudgeService } from './slack/slack-nudge-service';

async function main(): Promise<void> {
  const config = loadServerConfig();
  assertLoopbackHostname(config.hostname);
  const database = new StandupDatabase(config.databasePath);

  try {
    seedFixtureData(database.db);

    const repository = new SqliteStandupRepository(database.db);
    const service = new StandupService(repository, DEFAULT_TEAM_SCOPE);
    const actorResolver = new TrustedActorResolver(repository);
    const scheduler = new DailySnapshotScheduler(
      service,
      new SchedulerRunStore(database.sqlite),
    );
    const channelName = loadDeclaredSlackChannelName();
    const runtime = await createRuntimeIntegration({
      channelName,
      service,
      actorResolver,
    });
    const nudgeService = config.slackBotToken
      ? new SlackNudgeService({
          repository,
          scope: DEFAULT_TEAM_SCOPE,
          token: config.slackBotToken,
        })
      : undefined;
    const app = createApiApp({
      service,
      database,
      scheduler,
      ...(nudgeService ? { nudgeService } : {}),
      runtimeStatus: () => runtime.runtimeStatus(),
    });
    app.all('/api/copilotkit/*', (context) =>
      runtime.copilotHandler(context.req.raw),
    );

    const server = serve({
      fetch: app.fetch,
      hostname: config.hostname,
      port: config.port,
    });
    scheduler.start();
    nudgeService?.start();

    console.log(
      `Standup Pulse API listening on http://${config.hostname}:${config.port}`,
    );
    void runtime
      .startChannels()
      .then(() => console.log(`Managed Channel ${channelName} is online`))
      .catch((error: unknown) => {
        console.warn(
          `Managed Channel ${channelName} is unavailable; the local API remains online while reconnecting`,
          {
            name: error instanceof Error ? error.name : 'UnknownError',
            message:
              error instanceof Error
                ? error.message
                : 'Unknown Channel startup failure',
          },
        );
      });

    let shuttingDown = false;
    async function shutdown(signal: string): Promise<void> {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Stopping Standup Pulse API after ${signal}`);
      await Promise.all([
        scheduler.stop(),
        nudgeService?.stop(),
        runtime.stopChannels(),
      ]);
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      database.close();
    }

    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        void shutdown(signal)
          .then(() => process.exit(0))
          .catch((error: unknown) => {
            console.error('API shutdown failed', {
              name: error instanceof Error ? error.name : 'UnknownError',
            });
            process.exit(1);
          });
      });
    }
  } catch (error) {
    database.close();
    throw error;
  }
}

void main().catch((error: unknown) => {
  console.error('Standup Pulse API failed to start', {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : 'Unknown startup failure',
  });
  process.exit(1);
});
