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
} from '@standup-pulse/standups-data';
import { StandupService } from '@standup-pulse/standups-domain';
import { createApiApp } from './app';
import { loadDeclaredSlackChannelName } from './channel-config';
import { createRuntimeIntegration } from './runtime';
import { SlackNudgeService } from './slack-nudge-service';

async function main(): Promise<void> {
  const database = new StandupDatabase(
    process.env['STANDUP_DATABASE_PATH'] ?? 'standup-pulse.sqlite',
  );

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
    const nudgeService = await createNudgeService(repository);
    const app = createApiApp({
      service,
      database,
      scheduler,
      ...(nudgeService ? { nudgeService } : {}),
      runtimeStatus: runtime.runtimeStatus,
    });
    app.route('/', runtime.copilotApp);

    await runtime.startChannels();

    const hostname = process.env['HOST'] ?? '127.0.0.1';
    const port = Number(process.env['PORT'] ?? '3000');
    const server = serve({ fetch: app.fetch, hostname, port });
    scheduler.start();

    console.log(`Standup Pulse API listening on http://${hostname}:${port}`);
    console.log(`Managed Channel ${channelName} is online`);

    let shuttingDown = false;
    async function shutdown(signal: string): Promise<void> {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Stopping Standup Pulse API after ${signal}`);
      scheduler.stop();
      await runtime.stopChannels();
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

async function createNudgeService(
  repository: SqliteStandupRepository,
): Promise<SlackNudgeService | undefined> {
  const token =
    process.env['INTELLIGENCE_CHANNEL_STANDUP_PULSE_SLACK_BOT_TOKEN'];
  if (!token) return undefined;

  const service = new SlackNudgeService({
    repository,
    scope: DEFAULT_TEAM_SCOPE,
    token,
  });
  try {
    await service.initialize();
    return service;
  } catch (error) {
    console.warn('Proactive Slack nudges are unavailable', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return undefined;
  }
}

void main().catch((error: unknown) => {
  console.error('Standup Pulse API failed to start', {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : 'Unknown startup failure',
  });
  process.exit(1);
});
