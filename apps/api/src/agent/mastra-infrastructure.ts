import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MastraCompositeStore,
  type ListTracesArgs,
  type ListTracesLightResponse,
  type ObservabilityStorage,
} from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import {
  MastraStorageExporter,
  Observability,
  SensitiveDataFilter,
} from '@mastra/observability';

const SENSITIVE_TRACE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'apikey',
  'auth',
  'authorization',
  'bearer',
  'bearertoken',
  'jwt',
  'credential',
  'clientsecret',
  'privatekey',
  'refresh',
  'ssn',
  'yesterday',
  'today',
  'blockers',
  'preview',
] as const;

export interface StandupMastraInfrastructureOptions {
  serviceName: string;
  dataDirectory?: string;
}

export async function createStandupMastraInfrastructure({
  serviceName,
  dataDirectory = resolve(
    process.cwd(),
    '.standup-pulse-data',
    'mastra-observability',
  ),
}: StandupMastraInfrastructureOptions) {
  mkdirSync(dataDirectory, { recursive: true });
  const safeServiceName = serviceName.replace(/[^a-z0-9-]/gi, '-');
  const observabilityStorage = new LibSQLStore({
    id: `${safeServiceName}-observability-domain`,
    url: `file:${resolve(dataDirectory, 'standup-pulse-observability.db')}`,
  });
  const resolvedObservabilityDomain =
    await observabilityStorage.getStore('observability');
  if (!resolvedObservabilityDomain) {
    throw new Error('Mastra observability storage is unavailable.');
  }
  const observabilityDomain = withLightweightTraceSupport(
    resolvedObservabilityDomain,
  );
  const storage = new MastraCompositeStore({
    id: `${safeServiceName}-storage`,
    default: new LibSQLStore({
      id: `${safeServiceName}-default`,
      url: `file:${resolve(dataDirectory, `${safeServiceName}.db`)}`,
    }),
    domains: {
      observability: observabilityDomain,
    },
  });
  const observability = new Observability({
    configs: {
      default: {
        serviceName,
        exporters: [new TraceOnlyMastraStorageExporter()],
        spanOutputProcessors: [
          new SensitiveDataFilter({
            sensitiveFields: [...SENSITIVE_TRACE_FIELDS],
          }),
        ],
        // LibSQL persists traces for Studio, but does not implement Mastra's
        // batched application-log domain. Keep trace export enabled without
        // continuously attempting unsupported batch log writes.
        logging: { enabled: false },
      },
    },
  });

  return { storage, observability };
}

class TraceOnlyMastraStorageExporter extends MastraStorageExporter {
  override onMetricEvent(): Promise<void> {
    return Promise.resolve();
  }
}

function withLightweightTraceSupport(
  storage: ObservabilityStorage,
): ObservabilityStorage {
  const listTraces = storage.listTraces.bind(storage);
  storage.listTracesLight = async (
    args: ListTracesArgs,
  ): Promise<ListTracesLightResponse> => {
    const result = await listTraces(args);
    const spans = result.spans.map((span) => ({
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      spanType: span.spanType,
      isEvent: span.isEvent,
      startedAt: span.startedAt,
      endedAt: span.endedAt,
      error: span.error,
      entityType: span.entityType,
      entityId: span.entityId,
      entityName: span.entityName,
      createdAt: span.createdAt,
      updatedAt: span.updatedAt,
    }));

    return {
      spans,
      pagination: result.pagination ?? {
        total: spans.length,
        page: 0,
        perPage: spans.length,
        hasMore: false,
      },
    };
  };
  return storage;
}
