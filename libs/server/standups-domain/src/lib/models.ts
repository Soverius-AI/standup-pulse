import type {
  IsoDate,
  SubmitStandupInput,
} from '@standup-pulse/shared-contracts';

export interface TeamScope {
  readonly teamId: string;
}

export interface TeamRecord {
  id: string;
  slug: string;
  name: string;
  timeZone: string;
  standupCloseLocalTime: string;
  active: boolean;
}

export interface MemberRecord {
  id: string;
  teamId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  slackUserId?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrustedActor {
  readonly memberId: string;
  readonly externalActorId: string;
  readonly source: 'slack' | 'dashboard' | 'system';
}

export interface StandupSource {
  source: 'slack' | 'dashboard' | 'system';
  sourceMessageId?: string;
}

export interface StandupRecord {
  id: string;
  teamId: string;
  memberId: string;
  workDate: IsoDate;
  yesterday: string;
  today: string;
  submittedAt: Date;
  source: StandupSource['source'];
  sourceMessageId?: string;
}

export interface BlockerRecord {
  id: string;
  teamId: string;
  standupId: string;
  memberId: string;
  title: string;
  category?: string;
  status: 'open' | 'resolved';
  openedAt: Date;
  resolvedAt?: Date;
}

export interface DailySnapshotRecord {
  teamId: string;
  workDate: IsoDate;
  roster: number;
  posted: number;
  missing: number;
  blocked: number;
  participationPct: number;
  generatedAt: Date;
}

export interface SaveStandupCommand {
  scope: TeamScope;
  actor: TrustedActor;
  workDate: IsoDate;
  input: SubmitStandupInput;
  source: StandupSource;
  submittedAt: Date;
}

export interface SaveStandupResult {
  standup: StandupRecord;
  blockers: BlockerRecord[];
  updated: boolean;
}

export interface CreateMemberCommand {
  displayName: string;
  email?: string;
  avatarUrl?: string;
  slackUserId?: string;
}

export interface UpdateMemberCommand {
  displayName?: string;
  email?: string | null;
  avatarUrl?: string | null;
  slackUserId?: string | null;
  active?: boolean;
}
