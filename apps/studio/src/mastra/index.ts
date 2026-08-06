import 'dotenv/config';

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mastra } from '@mastra/core';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraEditor } from '@mastra/editor';
import { LibSQLStore } from '@mastra/libsql';
import {
  MastraStorageExporter,
  Observability,
  SensitiveDataFilter,
} from '@mastra/observability';
import {
  createLocalGemmaModel,
  createStandupPulseAgent,
  loadLocalModelConfig,
  STANDUP_PULSE_AGENT_ID,
} from '@standup-pulse/standup-agent';
import {
  DEFAULT_TEAM_SCOPE,
  seedFixtureData,
  SqliteStandupRepository,
  StandupDatabase,
} from '@standup-pulse/standups-data';
import { StandupService } from '@standup-pulse/standups-domain';
import { StudioStandupReadService } from './studio-standup-read-service';

const workspaceRoot = findWorkspaceRoot(
  dirname(fileURLToPath(import.meta.url)),
);
const observabilityDataDirectory = resolve(
  workspaceRoot,
  '.standup-pulse-data',
  'mastra-observability',
);
mkdirSync(observabilityDataDirectory, { recursive: true });

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
const observabilityStorage = new DuckDBStore({
  id: 'standup-pulse-observability',
  path: resolve(
    observabilityDataDirectory,
    'standup-pulse-observability.duckdb',
  ),
  memoryLimit: '512MB',
  threads: 2,
});

/**
 * Mastra's development server discovers this named export and exposes the
 * registered agent, tools, request context, and execution traces in Studio.
 */
export const mastra = new Mastra({
  agents: { [STANDUP_PULSE_AGENT_ID]: standupPulseAgent },
  storage: new MastraCompositeStore({
    id: 'standup-pulse-studio-storage',
    default: new LibSQLStore({
      id: 'standup-pulse-studio',
      url: `file:${resolve(
        observabilityDataDirectory,
        'standup-pulse-studio.db',
      )}`,
    }),
    domains: {
      observability: await observabilityStorage.getStore('observability'),
    },
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'standup-pulse-studio',
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
        logging: { enabled: true, level: 'info' },
      },
    },
  }),
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
