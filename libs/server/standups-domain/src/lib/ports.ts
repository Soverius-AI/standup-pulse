import type { IsoDate } from '@standup-pulse/shared-contracts';
import type {
  BlockerRecord,
  CreateMemberCommand,
  DailySnapshotRecord,
  MemberRecord,
  SaveStandupCommand,
  SaveStandupResult,
  StandupRecord,
  TeamRecord,
  TeamScope,
  UpdateMemberCommand,
} from './models';

export interface StandupRepository {
  getTeam(scope: TeamScope): Promise<TeamRecord | undefined>;
  listMembers(scope: TeamScope): Promise<MemberRecord[]>;
  listActiveMembers(scope: TeamScope): Promise<MemberRecord[]>;
  findMember(
    scope: TeamScope,
    memberId: string,
  ): Promise<MemberRecord | undefined>;
  findMemberBySlackUserId(
    scope: TeamScope,
    slackUserId: string,
  ): Promise<MemberRecord | undefined>;
  createMember(
    scope: TeamScope,
    command: CreateMemberCommand,
    now: Date,
  ): Promise<MemberRecord>;
  updateMember(
    scope: TeamScope,
    memberId: string,
    command: UpdateMemberCommand,
    now: Date,
  ): Promise<MemberRecord | undefined>;
  saveStandupWithBlockers(
    command: SaveStandupCommand,
  ): Promise<SaveStandupResult>;
  listStandups(scope: TeamScope, workDate: IsoDate): Promise<StandupRecord[]>;
  listOpenBlockers(
    scope: TeamScope,
    throughDate: IsoDate,
  ): Promise<BlockerRecord[]>;
  getSnapshot(
    scope: TeamScope,
    workDate: IsoDate,
  ): Promise<DailySnapshotRecord | undefined>;
  upsertSnapshot(snapshot: DailySnapshotRecord): Promise<void>;
}
