import 'dotenv/config';

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mastra } from '@mastra/core';
import { MastraEditor } from '@mastra/editor';
import {
  createLocalGemmaModel,
  createStandupMastraInfrastructure,
  createStandupPulseAgent,
  loadLocalModelConfig,
  STANDUP_PULSE_AGENT_ID,
} from '../../agent';
import {
  DEFAULT_TEAM_SCOPE,
  seedFixtureData,
  SqliteStandupRepository,
  StandupDatabase,
} from '../../data';
import { StandupService } from '../../domain';
import { StudioStandupReadService } from './studio-standup-read-service';

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);
const observabilityDataDirectory = resolve(
  workspaceRoot,
  '.standup-pulse-data',
  'mastra-observability',
);

const database = new StandupDatabase(
  process.env['STANDUP_DATABASE_PATH'] ??
    resolve(workspaceRoot, 'standup-pulse.sqlite'),
);
seedFixtureData(database.db);

const repository = new SqliteStandupRepository(database.db);
const service = new StandupService(repository, DEFAULT_TEAM_SCOPE);
const model = createLocalGemmaModel(loadLocalModelConfig(process.env));
const standupPulseAgent = createStandupPulseAgent({
  model,
  readService: new StudioStandupReadService(service),
});
const mastraInfrastructure = await createStandupMastraInfrastructure({
  serviceName: 'standup-pulse-studio',
  dataDirectory: observabilityDataDirectory,
});

/**
 * Mastra's development server discovers this named export and exposes the
 * registered agent, tools, request context, and execution traces in Studio.
 */
export const mastra = new Mastra({
  agents: { [STANDUP_PULSE_AGENT_ID]: standupPulseAgent },
  ...mastraInfrastructure,
  editor: new MastraEditor(),
});

function findWorkspaceRoot(start: string): string {
  let current = start;
  while (true) {
    if (existsSync(resolve(current, 'nx.json'))) return current;
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('Could not locate the Standup Pulse workspace root');
    }
    current = parent;
  }
}
