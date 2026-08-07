import type { TeamScope } from '../domain';
import type { StandupDrizzleDatabase } from './database';
import { members, teams } from './schema';

export const DEFAULT_TEAM_SCOPE: TeamScope = { teamId: 'team-default' };

export const FIXTURE_MEMBER_IDS = {
  ada: 'member-ada',
  grace: 'member-grace',
  linus: 'member-linus',
} as const;

export const FIXTURE_SLACK_USER_IDS = {
  ada: 'U_FIXTURE_ADA',
  grace: 'U_FIXTURE_GRACE',
} as const;

export function seedFixtureData(db: StandupDrizzleDatabase): void {
  const timestamp = new Date('2026-01-01T00:00:00.000Z');
  db.insert(teams)
    .values({
      id: DEFAULT_TEAM_SCOPE.teamId,
      slug: 'standup-pulse',
      name: 'Standup Pulse',
      timeZone: 'Europe/Vienna',
      standupCloseLocalTime: '16:00',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoNothing()
    .run();

  db.insert(members)
    .values([
      {
        id: FIXTURE_MEMBER_IDS.ada,
        teamId: DEFAULT_TEAM_SCOPE.teamId,
        displayName: 'Ada Lovelace',
        email: 'ada@example.test',
        slackUserId: FIXTURE_SLACK_USER_IDS.ada,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: FIXTURE_MEMBER_IDS.grace,
        teamId: DEFAULT_TEAM_SCOPE.teamId,
        displayName: 'Grace Hopper',
        email: 'grace@example.test',
        slackUserId: FIXTURE_SLACK_USER_IDS.grace,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: FIXTURE_MEMBER_IDS.linus,
        teamId: DEFAULT_TEAM_SCOPE.teamId,
        displayName: 'Linus Torvalds',
        email: 'linus@example.test',
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])
    .onConflictDoNothing()
    .run();
}
