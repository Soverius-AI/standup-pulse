export interface ServerConfig {
  hostname: string;
  port: number;
  databasePath: string;
  slackBotToken: string | undefined;
}

export function loadServerConfig(
  environment: Record<string, string | undefined> = process.env,
): ServerConfig {
  return {
    hostname: environment['HOST'] ?? '127.0.0.1',
    port: Number(environment['PORT'] ?? '3000'),
    databasePath:
      environment['STANDUP_DATABASE_PATH'] ?? 'standup-pulse.sqlite',
    slackBotToken:
      environment['INTELLIGENCE_CHANNEL_STANDUP_PULSE_SLACK_BOT_TOKEN'],
  };
}

export function requiredEnv(
  environment: Record<string, string | undefined>,
  name: string,
): string {
  const value = environment[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}
