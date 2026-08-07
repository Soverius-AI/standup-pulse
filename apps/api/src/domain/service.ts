import type {
  CreateRosterMemberRequest,
  IsoDate,
  NudgeResponse,
  RosterResponse,
  StandupReceiptViewModel,
  SubmitStandupInput,
  TeamPulseViewModel,
  UpdateRosterMemberRequest,
} from '@standup-pulse/shared-contracts';
import { StandupDomainError } from './errors';
import type {
  DailySnapshotRecord,
  MemberRecord,
  StandupSource,
  TeamRecord,
  TeamScope,
  TrustedActor,
} from './models';
import type { StandupRepository } from './ports';
import { differenceInDays, getLocalDate, shiftIsoDate } from './time';

interface PulseDay {
  roster: number;
  posted: number;
  missing: number;
  blocked: number;
  participationPct: number;
}

export class StandupService {
  constructor(
    private readonly repository: StandupRepository,
    readonly scope: TeamScope,
  ) {}

  async getTeam(): Promise<TeamRecord> {
    const team = await this.repository.getTeam(this.scope);
    if (!team || !team.active) {
      throw new StandupDomainError(
        'TEAM_NOT_FOUND',
        'The configured team does not exist',
      );
    }
    return team;
  }

  async submitStandup(
    actor: TrustedActor,
    input: SubmitStandupInput,
    source: StandupSource,
    now = new Date(),
  ): Promise<StandupReceiptViewModel> {
    const [team, member] = await Promise.all([
      this.getTeam(),
      this.repository.findMember(this.scope, actor.memberId),
    ]);
    if (!member || !member.active) {
      throw new StandupDomainError(
        'ACTOR_NOT_IN_TEAM',
        'The trusted actor is not an active team member',
      );
    }

    const workDate = getLocalDate(now, team.timeZone);
    const result = await this.repository.saveStandupWithBlockers({
      scope: this.scope,
      actor,
      workDate,
      input,
      source,
      submittedAt: now,
    });

    return {
      team: toTeamSummary(team),
      date: workDate,
      member: toMemberSummary(member),
      submittedAt: result.standup.submittedAt.toISOString(),
      blockerCount: result.blockers.filter(
        (blocker) => blocker.status === 'open',
      ).length,
      updated: result.updated,
    };
  }

  async getRoster(): Promise<RosterResponse> {
    const [team, members] = await Promise.all([
      this.getTeam(),
      this.repository.listMembers(this.scope),
    ]);
    return {
      team: toTeamSummary(team),
      members: members.map((member) => ({
        id: member.id,
        displayName: member.displayName,
        ...(member.email ? { email: member.email } : {}),
        ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
        slackLinked: Boolean(member.slackUserId),
        active: member.active,
      })),
    };
  }

  async createRosterMember(
    input: CreateRosterMemberRequest,
    now = new Date(),
  ): Promise<MemberRecord> {
    await this.getTeam();
    return this.repository.createMember(
      this.scope,
      {
        displayName: input.displayName,
        ...(input.email === undefined ? {} : { email: input.email }),
        ...(input.avatarUrl === undefined
          ? {}
          : { avatarUrl: input.avatarUrl }),
        ...(input.slackUserId === undefined
          ? {}
          : { slackUserId: input.slackUserId }),
      },
      now,
    );
  }

  async updateRosterMember(
    memberId: string,
    input: UpdateRosterMemberRequest,
    now = new Date(),
  ): Promise<MemberRecord> {
    await this.getTeam();
    const member = await this.repository.updateMember(
      this.scope,
      memberId,
      {
        ...(input.displayName === undefined
          ? {}
          : { displayName: input.displayName }),
        ...(input.email === undefined ? {} : { email: input.email }),
        ...(input.avatarUrl === undefined
          ? {}
          : { avatarUrl: input.avatarUrl }),
        ...(input.slackUserId === undefined
          ? {}
          : { slackUserId: input.slackUserId }),
        ...(input.active === undefined ? {} : { active: input.active }),
      },
      now,
    );
    if (!member)
      throw new StandupDomainError(
        'MEMBER_NOT_FOUND',
        'Roster member not found',
      );
    return member;
  }

  async getTeamPulse(
    date: IsoDate,
    now = new Date(),
    rangeDays = 7,
  ): Promise<TeamPulseViewModel> {
    const team = await this.getTeam();
    const boundedRangeDays = Math.min(30, Math.max(1, Math.trunc(rangeDays)));
    const dates = Array.from({ length: boundedRangeDays }, (_, index) =>
      shiftIsoDate(date, index - (boundedRangeDays - 1)),
    );
    const [members, selectedStandups, openBlockers] = await Promise.all([
      this.repository.listActiveMembers(this.scope),
      this.repository.listStandups(this.scope, date),
      this.repository.listOpenBlockers(this.scope, date),
    ]);
    const activeMemberIds = new Set(members.map(({ id }) => id));
    const activeMemberById = new Map(
      members.map((member) => [member.id, member]),
    );
    const activeOpenBlockers = openBlockers.filter(({ memberId }) =>
      activeMemberIds.has(memberId),
    );
    const standupByMember = new Map(
      selectedStandups.map((standup) => [standup.memberId, standup]),
    );
    const blockersByMember = new Map<string, typeof activeOpenBlockers>();
    for (const blocker of activeOpenBlockers) {
      const existing = blockersByMember.get(blocker.memberId) ?? [];
      existing.push(blocker);
      blockersByMember.set(blocker.memberId, existing);
    }

    const selectedDay = calculateDay(
      members,
      selectedStandups,
      activeOpenBlockers,
    );
    const previousDay = await this.getPulseDay(shiftIsoDate(date, -1), members);
    const trend = await Promise.all(
      dates.map(async (trendDate) => {
        const day =
          trendDate === date
            ? selectedDay
            : await this.getPulseDay(trendDate, members);
        return { date: trendDate, participationPct: day.participationPct };
      }),
    );

    return {
      team: toTeamSummary(team),
      date,
      generatedAt: now.toISOString(),
      totals: selectedDay,
      deltas: {
        posted: selectedDay.posted - previousDay.posted,
        missing: selectedDay.missing - previousDay.missing,
        blocked: selectedDay.blocked - previousDay.blocked,
        participationPoints:
          selectedDay.participationPct - previousDay.participationPct,
      },
      standups: members.map((member) => {
        const standup = standupByMember.get(member.id);
        const memberBlockers = blockersByMember.get(member.id) ?? [];
        const firstBlocker = memberBlockers[0];
        return {
          memberId: member.id,
          displayName: member.displayName,
          ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
          status: !standup
            ? ('missing' as const)
            : firstBlocker
              ? ('blocked' as const)
              : ('posted' as const),
          ...(standup ? { preview: standup.today } : {}),
          ...(firstBlocker ? { blockerId: firstBlocker.id } : {}),
        };
      }),
      trend,
      blockers: activeOpenBlockers.flatMap((blocker) => {
        const member = activeMemberById.get(blocker.memberId);
        return member
          ? [
              {
                id: blocker.id,
                title: blocker.title,
                owner: toMemberSummary(member),
                ageDays: differenceInDays(now, blocker.openedAt),
              },
            ]
          : [];
      }),
    };
  }

  async generateDailySnapshot(
    date: IsoDate,
    now = new Date(),
  ): Promise<DailySnapshotRecord> {
    const members = await this.repository.listActiveMembers(this.scope);
    const day = await this.getPulseDay(date, members, false);
    const snapshot: DailySnapshotRecord = {
      teamId: this.scope.teamId,
      workDate: date,
      ...day,
      generatedAt: now,
    };
    await this.repository.upsertSnapshot(snapshot);
    return snapshot;
  }

  async requestNudges(
    memberIds: string[],
    _date: IsoDate,
    _requestId: string,
    now = new Date(),
  ): Promise<NudgeResponse> {
    const activeMembers = await this.repository.listActiveMembers(this.scope);
    const activeIds = new Set(activeMembers.map((member) => member.id));
    return {
      deliveries: memberIds.map((memberId) => ({
        memberId,
        status: 'unavailable' as const,
        message: activeIds.has(memberId)
          ? 'Proactive Slack delivery is not supported by the current managed Channel runtime.'
          : 'Member is not in the active roster.',
      })),
      completedAt: now.toISOString(),
    };
  }

  async listBlockers(
    status: 'open' | 'resolved' = 'open',
    limit = 100,
  ): Promise<
    Array<{
      blocker: Awaited<ReturnType<StandupRepository['listBlockers']>>[number];
      owner: MemberRecord;
    }>
  > {
    const blockers = await this.repository.listBlockers(
      this.scope,
      status,
      Math.min(100, Math.max(1, Math.trunc(limit))),
    );
    const withOwners = await Promise.all(
      blockers.map(async (blocker) => ({
        blocker,
        owner: await this.repository.findMember(this.scope, blocker.memberId),
      })),
    );
    return withOwners.flatMap(({ blocker, owner }) =>
      owner ? [{ blocker, owner }] : [],
    );
  }

  private async getPulseDay(
    date: IsoDate,
    members: MemberRecord[],
    preferSnapshot = true,
  ): Promise<PulseDay> {
    if (preferSnapshot) {
      const snapshot = await this.repository.getSnapshot(this.scope, date);
      if (snapshot) return snapshot;
    }
    const [standups, blockers] = await Promise.all([
      this.repository.listStandups(this.scope, date),
      this.repository.listOpenBlockers(this.scope, date),
    ]);
    return calculateDay(members, standups, blockers);
  }
}

function calculateDay(
  members: MemberRecord[],
  standups: { memberId: string }[],
  blockers: { memberId: string }[],
): PulseDay {
  const memberIds = new Set(members.map((member) => member.id));
  const posted = new Set(
    standups
      .filter((item) => memberIds.has(item.memberId))
      .map((item) => item.memberId),
  );
  const blocked = blockers.filter((item) =>
    memberIds.has(item.memberId),
  ).length;
  return calculateDayFromCount(members.length, posted.size, blocked);
}

function calculateDayFromCount(
  roster: number,
  posted: number,
  blocked: number,
): PulseDay {
  const boundedPosted = Math.min(roster, posted);
  return {
    roster,
    posted: boundedPosted,
    missing: Math.max(0, roster - boundedPosted),
    blocked,
    participationPct:
      roster === 0 ? 0 : Math.round((boundedPosted / roster) * 1_000) / 10,
  };
}

function toTeamSummary(team: TeamRecord) {
  return { id: team.id, name: team.name, timeZone: team.timeZone };
}

function toMemberSummary(member: MemberRecord) {
  return {
    memberId: member.id,
    displayName: member.displayName,
    ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
  };
}
