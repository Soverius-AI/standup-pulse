import type { IsoDate } from '@standup-pulse/shared-contracts';
import {
  getLocalClockParts,
  parseLocalTime,
  type StandupService,
  type TeamScope,
} from '../domain';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';

const DAILY_SNAPSHOT_JOB = 'daily-snapshot';
const DEFAULT_LEASE_MS = 10 * 60 * 1_000;

export interface SchedulerTickResult {
  ran: boolean;
  idempotencyKey?: string;
  reason?: 'before-schedule' | 'already-claimed';
}

export class SchedulerRunStore {
  constructor(private readonly sqlite: BetterSqliteDatabase) {}

  tryClaim(
    scope: TeamScope,
    job: string,
    workDate: IsoDate,
    scheduledLocalTime: string,
    now: Date,
    leaseMs = DEFAULT_LEASE_MS,
  ): { claimed: boolean; idempotencyKey: string } {
    const idempotencyKey = `${scope.teamId}:${job}:${workDate}:${scheduledLocalTime}`;
    const result = this.sqlite
      .prepare(
        `INSERT INTO scheduler_runs (
          idempotency_key, team_id, job, work_date, scheduled_local_time,
          status, attempt, lease_until, started_at
        ) VALUES (?, ?, ?, ?, ?, 'running', 1, ?, ?)
        ON CONFLICT(idempotency_key) DO UPDATE SET
          status = 'running',
          attempt = scheduler_runs.attempt + 1,
          lease_until = excluded.lease_until,
          started_at = excluded.started_at,
          completed_at = NULL,
          error_code = NULL
        WHERE scheduler_runs.status != 'completed'
          AND (scheduler_runs.status != 'running' OR scheduler_runs.lease_until < excluded.started_at)`,
      )
      .run(
        idempotencyKey,
        scope.teamId,
        job,
        workDate,
        scheduledLocalTime,
        now.getTime() + leaseMs,
        now.getTime(),
      );
    return { claimed: result.changes === 1, idempotencyKey };
  }

  complete(idempotencyKey: string, now: Date): void {
    this.sqlite
      .prepare(
        `UPDATE scheduler_runs
         SET status = 'completed', completed_at = ?, lease_until = NULL, error_code = NULL
         WHERE idempotency_key = ?`,
      )
      .run(now.getTime(), idempotencyKey);
  }

  fail(idempotencyKey: string, errorCode: string): void {
    this.sqlite
      .prepare(
        `UPDATE scheduler_runs
         SET status = 'failed', lease_until = NULL, error_code = ?
         WHERE idempotency_key = ?`,
      )
      .run(errorCode, idempotencyKey);
  }

  lastCompletedAt(scope: TeamScope): Date | undefined {
    const row = this.sqlite
      .prepare(
        `SELECT MAX(completed_at) AS completed_at
         FROM scheduler_runs WHERE team_id = ? AND status = 'completed'`,
      )
      .get(scope.teamId) as { completed_at: number | null };
    return row.completed_at === null ? undefined : new Date(row.completed_at);
  }
}

export class DailySnapshotScheduler {
  private timer: ReturnType<typeof setInterval> | undefined;
  private activeTick: Promise<void> | undefined;
  private running = false;
  private lastError: string | undefined;

  constructor(
    private readonly service: StandupService,
    private readonly runStore: SchedulerRunStore,
    private readonly intervalMs = 60_000,
  ) {}

  async tick(now = new Date()): Promise<SchedulerTickResult> {
    const team = await this.service.getTeam();
    const local = getLocalClockParts(now, team.timeZone);
    const localMinute = local.hour * 60 + local.minute;
    if (localMinute < parseLocalTime(team.standupCloseLocalTime)) {
      return { ran: false, reason: 'before-schedule' };
    }

    const claim = this.runStore.tryClaim(
      this.service.scope,
      DAILY_SNAPSHOT_JOB,
      local.date,
      team.standupCloseLocalTime,
      now,
    );
    if (!claim.claimed) {
      return {
        ran: false,
        reason: 'already-claimed',
        idempotencyKey: claim.idempotencyKey,
      };
    }

    try {
      await this.service.generateDailySnapshot(local.date, now);
      this.runStore.complete(claim.idempotencyKey, now);
      this.lastError = undefined;
      return { ran: true, idempotencyKey: claim.idempotencyKey };
    } catch (error) {
      const errorCode = error instanceof Error ? error.name : 'UnknownError';
      this.runStore.fail(claim.idempotencyKey, errorCode);
      this.lastError = errorCode;
      throw error;
    }
  }

  start(): void {
    if (this.timer) return;
    this.running = true;
    this.runScheduledTick();
    this.timer = setInterval(() => this.runScheduledTick(), this.intervalMs);
  }

  async stop(timeoutMs = 5_000): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.running = false;
    const activeTick = this.activeTick;
    if (!activeTick) return;
    await Promise.race([
      activeTick,
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  }

  status(): { running: boolean; lastRunAt?: Date; lastError?: string } {
    const lastRunAt = this.runStore.lastCompletedAt(this.service.scope);
    return {
      running: this.running,
      ...(lastRunAt ? { lastRunAt } : {}),
      ...(this.lastError ? { lastError: this.lastError } : {}),
    };
  }

  private runScheduledTick(): void {
    if (this.activeTick) return;
    this.activeTick = this.tick()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        this.activeTick = undefined;
      });
  }
}
