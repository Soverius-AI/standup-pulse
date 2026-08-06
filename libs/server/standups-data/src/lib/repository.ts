import { randomUUID } from 'node:crypto';
import type { IsoDate } from '@standup-pulse/shared-contracts';
import type {
  BlockerRecord,
  CreateMemberCommand,
  DailySnapshotRecord,
  MemberRecord,
  SaveStandupCommand,
  SaveStandupResult,
  StandupRecord,
  StandupRepository,
  TeamRecord,
  TeamScope,
  UpdateMemberCommand,
} from '@standup-pulse/standups-domain';
import { and, asc, eq, lte } from 'drizzle-orm';
import type { StandupDrizzleDatabase } from './database';
import { blockers, dailySnapshots, members, standups, teams } from './schema';

export class SqliteStandupRepository implements StandupRepository {
  constructor(private readonly db: StandupDrizzleDatabase) {}

  async getTeam(scope: TeamScope): Promise<TeamRecord | undefined> {
    const row = this.db
      .select()
      .from(teams)
      .where(eq(teams.id, scope.teamId))
      .get();
    return row ? mapTeam(row) : undefined;
  }

  async listActiveMembers(scope: TeamScope): Promise<MemberRecord[]> {
    return this.db
      .select()
      .from(members)
      .where(and(eq(members.teamId, scope.teamId), eq(members.active, true)))
      .orderBy(asc(members.displayName))
      .all()
      .map(mapMember);
  }

  async listMembers(scope: TeamScope): Promise<MemberRecord[]> {
    return this.db
      .select()
      .from(members)
      .where(eq(members.teamId, scope.teamId))
      .orderBy(asc(members.displayName))
      .all()
      .map(mapMember);
  }

  async findMember(
    scope: TeamScope,
    memberId: string,
  ): Promise<MemberRecord | undefined> {
    const row = this.db
      .select()
      .from(members)
      .where(and(eq(members.teamId, scope.teamId), eq(members.id, memberId)))
      .get();
    return row ? mapMember(row) : undefined;
  }

  async findMemberBySlackUserId(
    scope: TeamScope,
    slackUserId: string,
  ): Promise<MemberRecord | undefined> {
    const row = this.db
      .select()
      .from(members)
      .where(
        and(
          eq(members.teamId, scope.teamId),
          eq(members.slackUserId, slackUserId),
        ),
      )
      .get();
    return row ? mapMember(row) : undefined;
  }

  async createMember(
    scope: TeamScope,
    command: CreateMemberCommand,
    now: Date,
  ): Promise<MemberRecord> {
    const row = {
      id: randomUUID(),
      teamId: scope.teamId,
      displayName: command.displayName,
      email: command.email ?? null,
      avatarUrl: command.avatarUrl ?? null,
      slackUserId: command.slackUserId ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(members).values(row).run();
    return mapMember(row);
  }

  async updateMember(
    scope: TeamScope,
    memberId: string,
    command: UpdateMemberCommand,
    now: Date,
  ): Promise<MemberRecord | undefined> {
    const existing = await this.findMember(scope, memberId);
    if (!existing) return undefined;

    this.db
      .update(members)
      .set({
        ...(command.displayName !== undefined
          ? { displayName: command.displayName }
          : {}),
        ...(command.email !== undefined ? { email: command.email } : {}),
        ...(command.avatarUrl !== undefined
          ? { avatarUrl: command.avatarUrl }
          : {}),
        ...(command.slackUserId !== undefined
          ? { slackUserId: command.slackUserId }
          : {}),
        ...(command.active !== undefined ? { active: command.active } : {}),
        updatedAt: now,
      })
      .where(and(eq(members.teamId, scope.teamId), eq(members.id, memberId)))
      .run();
    return this.findMember(scope, memberId);
  }

  async saveStandupWithBlockers(
    command: SaveStandupCommand,
  ): Promise<SaveStandupResult> {
    return this.db.transaction((tx) => {
      if (command.source.sourceMessageId) {
        const duplicate = tx
          .select()
          .from(standups)
          .where(
            and(
              eq(standups.source, command.source.source),
              eq(standups.sourceMessageId, command.source.sourceMessageId),
            ),
          )
          .get();
        if (duplicate) {
          const duplicateBlockers = tx
            .select()
            .from(blockers)
            .where(eq(blockers.standupId, duplicate.id))
            .all()
            .map(mapBlocker);
          return {
            standup: mapStandup(duplicate),
            blockers: duplicateBlockers,
            updated: false,
          };
        }
      }

      const existing = tx
        .select()
        .from(standups)
        .where(
          and(
            eq(standups.teamId, command.scope.teamId),
            eq(standups.memberId, command.actor.memberId),
            eq(standups.workDate, command.workDate),
          ),
        )
        .get();
      const standupId = existing?.id ?? randomUUID();
      const standupRow = {
        id: standupId,
        teamId: command.scope.teamId,
        memberId: command.actor.memberId,
        workDate: command.workDate,
        yesterday: command.input.yesterday,
        today: command.input.today,
        submittedAt: command.submittedAt,
        source: command.source.source,
        sourceMessageId: command.source.sourceMessageId ?? null,
      };

      if (existing) {
        tx.update(standups)
          .set(standupRow)
          .where(eq(standups.id, standupId))
          .run();
        tx.update(blockers)
          .set({ status: 'resolved', resolvedAt: command.submittedAt })
          .where(
            and(eq(blockers.standupId, standupId), eq(blockers.status, 'open')),
          )
          .run();
      } else {
        tx.insert(standups).values(standupRow).run();
      }

      const blockerRows = command.input.blockers.map((title) => ({
        id: randomUUID(),
        teamId: command.scope.teamId,
        standupId,
        memberId: command.actor.memberId,
        title,
        category: null,
        status: 'open' as const,
        openedAt: command.submittedAt,
        resolvedAt: null,
      }));
      if (blockerRows.length > 0) tx.insert(blockers).values(blockerRows).run();

      return {
        standup: mapStandup(standupRow),
        blockers: blockerRows.map(mapBlocker),
        updated: Boolean(existing),
      };
    });
  }

  async listStandups(
    scope: TeamScope,
    workDate: IsoDate,
  ): Promise<StandupRecord[]> {
    return this.db
      .select()
      .from(standups)
      .where(
        and(eq(standups.teamId, scope.teamId), eq(standups.workDate, workDate)),
      )
      .all()
      .map(mapStandup);
  }

  async listOpenBlockers(
    scope: TeamScope,
    throughDate: IsoDate,
  ): Promise<BlockerRecord[]> {
    return this.db
      .select({
        id: blockers.id,
        teamId: blockers.teamId,
        standupId: blockers.standupId,
        memberId: blockers.memberId,
        title: blockers.title,
        category: blockers.category,
        status: blockers.status,
        openedAt: blockers.openedAt,
        resolvedAt: blockers.resolvedAt,
      })
      .from(blockers)
      .innerJoin(standups, eq(blockers.standupId, standups.id))
      .where(
        and(
          eq(blockers.teamId, scope.teamId),
          eq(blockers.status, 'open'),
          lte(standups.workDate, throughDate),
        ),
      )
      .all()
      .map(mapBlocker);
  }

  async getSnapshot(
    scope: TeamScope,
    workDate: IsoDate,
  ): Promise<DailySnapshotRecord | undefined> {
    const row = this.db
      .select()
      .from(dailySnapshots)
      .where(
        and(
          eq(dailySnapshots.teamId, scope.teamId),
          eq(dailySnapshots.workDate, workDate),
        ),
      )
      .get();
    return row ? mapSnapshot(row) : undefined;
  }

  async upsertSnapshot(snapshot: DailySnapshotRecord): Promise<void> {
    this.db
      .insert(dailySnapshots)
      .values(snapshot)
      .onConflictDoUpdate({
        target: [dailySnapshots.teamId, dailySnapshots.workDate],
        set: {
          roster: snapshot.roster,
          posted: snapshot.posted,
          missing: snapshot.missing,
          blocked: snapshot.blocked,
          participationPct: snapshot.participationPct,
          generatedAt: snapshot.generatedAt,
        },
      })
      .run();
  }
}

function mapTeam(row: typeof teams.$inferSelect): TeamRecord {
  return row;
}

function mapMember(row: typeof members.$inferSelect): MemberRecord {
  const { email, avatarUrl, slackUserId, ...required } = row;
  return {
    ...required,
    ...(email ? { email } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(slackUserId ? { slackUserId } : {}),
  };
}

function mapStandup(row: typeof standups.$inferSelect): StandupRecord {
  const { sourceMessageId, ...required } = row;
  return {
    ...required,
    workDate: row.workDate as IsoDate,
    ...(sourceMessageId ? { sourceMessageId } : {}),
  };
}

function mapBlocker(row: typeof blockers.$inferSelect): BlockerRecord {
  const { category, resolvedAt, ...required } = row;
  return {
    ...required,
    ...(category ? { category } : {}),
    ...(resolvedAt ? { resolvedAt } : {}),
  };
}

function mapSnapshot(
  row: typeof dailySnapshots.$inferSelect,
): DailySnapshotRecord {
  return { ...row, workDate: row.workDate as IsoDate };
}
