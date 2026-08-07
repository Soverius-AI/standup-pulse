import { readFileSync } from 'node:fs';
import { StandupService } from '../domain';
import { IsoDateSchema } from '@standup-pulse/shared-contracts';
import { eq } from 'drizzle-orm';
import { StandupDatabase } from './database';
import {
  DEFAULT_TEAM_SCOPE,
  FIXTURE_MEMBER_IDS,
  FIXTURE_SLACK_USER_IDS,
  seedFixtureData,
} from './fixtures';
import { TrustedActorResolver, type SlackActorInput } from './identity';
import { MIGRATION_0000_SQL, MIGRATION_0001_SQL } from './migrations';
import { SqliteStandupRepository } from './repository';
import { DailySnapshotScheduler, SchedulerRunStore } from './scheduler';
import { teams } from './schema';

const AUGUST_6 = IsoDateSchema.parse('2026-08-06');

function createFixture() {
  const database = new StandupDatabase();
  seedFixtureData(database.db);
  const repository = new SqliteStandupRepository(database.db);
  const service = new StandupService(repository, DEFAULT_TEAM_SCOPE);
  return { database, repository, service };
}

describe('SQLite standup data', () => {
  it('applies the checked-in migration to a fresh database', () => {
    const database = new StandupDatabase();
    try {
      const tables = database.sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        )
        .all() as { name: string }[];
      expect(tables.map((table) => table.name)).toEqual(
        expect.arrayContaining([
          'teams',
          'members',
          'standups',
          'blockers',
          'daily_snapshots',
          'scheduler_runs',
          'delivery_outbox',
        ]),
      );
      expect(database.sqlite.pragma('user_version', { simple: true })).toBe(2);

      const checkedInSql = readFileSync(
        new URL('../../drizzle/0000_initial.sql', import.meta.url),
        'utf8',
      );
      expect(normalizeSql(MIGRATION_0000_SQL)).toBe(normalizeSql(checkedInSql));
      expect(normalizeSql(MIGRATION_0001_SQL)).toBe(
        normalizeSql(
          readFileSync(
            new URL(
              '../../drizzle/0001_channel_event_identity.sql',
              import.meta.url,
            ),
            'utf8',
          ),
        ),
      );
    } finally {
      database.close();
    }
  });

  it('derives trusted identity solely from the Slack actor id', async () => {
    const { database, repository } = createFixture();
    try {
      const resolver = new TrustedActorResolver(repository);
      const spoofedInput = {
        externalUserId: FIXTURE_SLACK_USER_IDS.ada,
        memberId: FIXTURE_MEMBER_IDS.grace,
      } as unknown as SlackActorInput;

      await expect(
        resolver.resolveSlackActor(DEFAULT_TEAM_SCOPE, spoofedInput),
      ).resolves.toEqual({
        memberId: FIXTURE_MEMBER_IDS.ada,
        externalActorId: FIXTURE_SLACK_USER_IDS.ada,
        source: 'slack',
      });
      await expect(
        resolver.resolveSlackActor(DEFAULT_TEAM_SCOPE, {
          externalUserId: 'U_UNKNOWN',
        }),
      ).rejects.toMatchObject({ code: 'EXTERNAL_ACTOR_NOT_LINKED' });
    } finally {
      database.close();
    }
  });

  it('computes participation, missing members, and blockers from persisted standups', async () => {
    const { database, repository, service } = createFixture();
    try {
      const resolver = new TrustedActorResolver(repository);
      const now = new Date('2026-08-06T08:00:00.000Z');
      const ada = await resolver.resolveSlackActor(DEFAULT_TEAM_SCOPE, {
        externalUserId: FIXTURE_SLACK_USER_IDS.ada,
      });
      const grace = await resolver.resolveSlackActor(DEFAULT_TEAM_SCOPE, {
        externalUserId: FIXTURE_SLACK_USER_IDS.grace,
      });

      await service.submitStandup(
        ada,
        { yesterday: 'Shipped the API', today: 'Write tests', blockers: [] },
        { source: 'slack', sourceMessageId: 'event-ada' },
        now,
      );
      await service.submitStandup(
        grace,
        {
          yesterday: 'Reviewed schemas',
          today: 'Wire the dashboard',
          blockers: ['Need design review'],
        },
        { source: 'slack', sourceMessageId: 'event-grace' },
        now,
      );

      const pulse = await service.getTeamPulse(AUGUST_6, now);
      expect(pulse.totals).toEqual({
        roster: 3,
        posted: 2,
        missing: 1,
        blocked: 1,
        participationPct: 66.7,
      });
      expect(
        pulse.standups.find(
          (item) => item.memberId === FIXTURE_MEMBER_IDS.grace,
        )?.status,
      ).toBe('blocked');
      expect(
        pulse.standups.find(
          (item) => item.memberId === FIXTURE_MEMBER_IDS.linus,
        )?.status,
      ).toBe('missing');
      expect(pulse.blockers).toHaveLength(1);
    } finally {
      database.close();
    }
  });

  it('deduplicates a repeated source message instead of overwriting the first submission', async () => {
    const { database, repository, service } = createFixture();
    try {
      const actor = await new TrustedActorResolver(
        repository,
      ).resolveSlackActor(DEFAULT_TEAM_SCOPE, {
        externalUserId: FIXTURE_SLACK_USER_IDS.ada,
      });
      const now = new Date('2026-08-06T08:00:00.000Z');
      await service.submitStandup(
        actor,
        { yesterday: 'Original', today: 'Original plan', blockers: [] },
        {
          source: 'slack',
          sourceMessageId: 'logical-message',
          sourceEventId: 'same-event',
        },
        now,
      );
      await service.submitStandup(
        actor,
        {
          yesterday: 'Spoofed retry',
          today: 'Must not overwrite',
          blockers: [],
        },
        {
          source: 'slack',
          sourceMessageId: 'logical-message',
          sourceEventId: 'same-event',
        },
        new Date('2026-08-06T08:01:00.000Z'),
      );

      const rows = await repository.listStandups(DEFAULT_TEAM_SCOPE, AUGUST_6);
      expect(rows).toHaveLength(1);
      expect(rows.at(0)?.today).toBe('Original plan');
    } finally {
      database.close();
    }
  });

  it('applies a Slack edit with a new event id to the same logical standup', async () => {
    const { database, repository, service } = createFixture();
    try {
      const actor = await new TrustedActorResolver(
        repository,
      ).resolveSlackActor(DEFAULT_TEAM_SCOPE, {
        externalUserId: FIXTURE_SLACK_USER_IDS.ada,
      });
      const now = new Date('2026-08-06T08:00:00.000Z');
      await service.submitStandup(
        actor,
        { yesterday: 'Original', today: 'Original plan', blockers: [] },
        {
          source: 'slack',
          sourceMessageId: 'logical-message',
          sourceEventId: 'event-1',
        },
        now,
      );
      await service.submitStandup(
        actor,
        { yesterday: 'Original', today: 'Edited plan', blockers: [] },
        {
          source: 'slack',
          sourceMessageId: 'logical-message',
          sourceEventId: 'event-2',
        },
        new Date('2026-08-06T08:01:00.000Z'),
      );

      const rows = await repository.listStandups(DEFAULT_TEAM_SCOPE, AUGUST_6);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        today: 'Edited plan',
        sourceMessageId: 'logical-message',
        sourceEventId: 'event-2',
      });
    } finally {
      database.close();
    }
  });

  it('honors pulse ranges and returns resolved blockers truthfully', async () => {
    const { database, repository, service } = createFixture();
    try {
      const actor = await new TrustedActorResolver(
        repository,
      ).resolveSlackActor(DEFAULT_TEAM_SCOPE, {
        externalUserId: FIXTURE_SLACK_USER_IDS.ada,
      });
      const now = new Date('2026-08-06T08:00:00.000Z');
      await service.submitStandup(
        actor,
        { yesterday: 'Original', today: 'Plan', blockers: ['Waiting'] },
        { source: 'slack', sourceEventId: 'event-blocked' },
        now,
      );
      await service.submitStandup(
        actor,
        { yesterday: 'Original', today: 'Unblocked', blockers: [] },
        { source: 'slack', sourceEventId: 'event-resolved' },
        new Date('2026-08-06T09:00:00.000Z'),
      );

      const pulse = await service.getTeamPulse(AUGUST_6, now, 3);
      const resolved = await service.listBlockers('resolved');

      expect(pulse.trend).toHaveLength(3);
      expect(resolved).toHaveLength(1);
      expect(resolved[0]).toMatchObject({
        blocker: { title: 'Waiting', status: 'resolved' },
        owner: { id: FIXTURE_MEMBER_IDS.ada },
      });
    } finally {
      database.close();
    }
  });

  it('excludes blockers owned by a deactivated member from the active pulse', async () => {
    const { database, repository, service } = createFixture();
    try {
      const actor = await new TrustedActorResolver(
        repository,
      ).resolveSlackActor(DEFAULT_TEAM_SCOPE, {
        externalUserId: FIXTURE_SLACK_USER_IDS.ada,
      });
      const now = new Date('2026-08-06T08:00:00.000Z');
      await service.submitStandup(
        actor,
        {
          yesterday: 'Reviewed the release',
          today: 'Ship the release',
          blockers: ['Waiting for approval'],
        },
        { source: 'slack', sourceMessageId: 'ada-blocked' },
        now,
      );
      await service.updateRosterMember(
        FIXTURE_MEMBER_IDS.ada,
        { active: false },
        now,
      );

      const pulse = await service.getTeamPulse(AUGUST_6, now);

      expect(pulse.totals).toMatchObject({ roster: 2, blocked: 0 });
      expect(pulse.blockers).toEqual([]);
      expect(
        pulse.standups.some(
          ({ memberId }) => memberId === FIXTURE_MEMBER_IDS.ada,
        ),
      ).toBe(false);
    } finally {
      database.close();
    }
  });

  it('runs once during the repeated DST hour and catches up after the skipped hour', async () => {
    const first = createFixture();
    try {
      first.database.db
        .update(teams)
        .set({ standupCloseLocalTime: '02:30' })
        .where(eq(teams.id, DEFAULT_TEAM_SCOPE.teamId))
        .run();
      const scheduler = new DailySnapshotScheduler(
        first.service,
        new SchedulerRunStore(first.database.sqlite),
      );

      await expect(
        scheduler.tick(new Date('2026-10-25T00:30:00.000Z')),
      ).resolves.toMatchObject({
        ran: true,
      });
      await expect(
        scheduler.tick(new Date('2026-10-25T01:30:00.000Z')),
      ).resolves.toMatchObject({
        ran: false,
        reason: 'already-claimed',
      });
      const runCount = first.database.sqlite
        .prepare('SELECT COUNT(*) AS count FROM scheduler_runs')
        .get() as { count: number };
      expect(runCount.count).toBe(1);
    } finally {
      first.database.close();
    }

    const second = createFixture();
    try {
      second.database.db
        .update(teams)
        .set({ standupCloseLocalTime: '02:30' })
        .where(eq(teams.id, DEFAULT_TEAM_SCOPE.teamId))
        .run();
      const scheduler = new DailySnapshotScheduler(
        second.service,
        new SchedulerRunStore(second.database.sqlite),
      );
      await expect(
        scheduler.tick(new Date('2026-03-29T01:00:00.000Z')),
      ).resolves.toMatchObject({
        ran: true,
      });
    } finally {
      second.database.close();
    }
  });

  it('drains an active scheduled snapshot before shutdown', async () => {
    const { database, service } = createFixture();
    try {
      database.db
        .update(teams)
        .set({ standupCloseLocalTime: '00:00' })
        .where(eq(teams.id, DEFAULT_TEAM_SCOPE.teamId))
        .run();
      let releaseSnapshot!: () => void;
      let markStarted!: () => void;
      const started = new Promise<void>((resolve) => {
        markStarted = resolve;
      });
      const release = new Promise<void>((resolve) => {
        releaseSnapshot = resolve;
      });
      vi.spyOn(service, 'generateDailySnapshot').mockImplementation(
        async (date, now) => {
          markStarted();
          await release;
          return {
            teamId: DEFAULT_TEAM_SCOPE.teamId,
            workDate: date,
            roster: 3,
            posted: 0,
            missing: 3,
            blocked: 0,
            participationPct: 0,
            generatedAt: now ?? new Date(0),
          };
        },
      );
      const scheduler = new DailySnapshotScheduler(
        service,
        new SchedulerRunStore(database.sqlite),
      );
      scheduler.start();
      await started;

      let stopped = false;
      const stopping = scheduler.stop(1_000).then(() => {
        stopped = true;
      });
      await Promise.resolve();
      expect(stopped).toBe(false);

      releaseSnapshot();
      await stopping;
      expect(stopped).toBe(true);
    } finally {
      database.close();
    }
  });
});

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
