import type { StandupDatabase } from '../data';
import type { DailySnapshotScheduler } from '../data';
import type { StandupService } from '../domain';
import type { ExternalRuntimeStatus } from '../runtime/runtime-status';
import type { ProactiveNudgeService } from '../slack/slack-nudge-service';

export interface ApiDependencies {
  service: StandupService;
  database: StandupDatabase;
  scheduler: DailySnapshotScheduler;
  nudgeService?: ProactiveNudgeService;
  runtimeStatus?: () => ExternalRuntimeStatus | Promise<ExternalRuntimeStatus>;
  now?: () => Date;
}

export interface RouteContext extends Omit<ApiDependencies, 'now'> {
  now: () => Date;
}
