import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  timeZone: text('time_zone').notNull(),
  standupCloseLocalTime: text('standup_close_local_time').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const members = sqliteTable(
  'members',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    email: text('email'),
    avatarUrl: text('avatar_url'),
    slackUserId: text('slack_user_id'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('members_team_slack_user_unique').on(
      table.teamId,
      table.slackUserId,
    ),
    index('members_team_active_idx').on(table.teamId, table.active),
  ],
);

export const standups = sqliteTable(
  'standups',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    workDate: text('work_date').notNull(),
    yesterday: text('yesterday').notNull(),
    today: text('today').notNull(),
    submittedAt: integer('submitted_at', { mode: 'timestamp_ms' }).notNull(),
    source: text('source', {
      enum: ['slack', 'dashboard', 'system'],
    }).notNull(),
    sourceMessageId: text('source_message_id'),
    sourceEventId: text('source_event_id'),
  },
  (table) => [
    uniqueIndex('standups_team_member_date_unique').on(
      table.teamId,
      table.memberId,
      table.workDate,
    ),
    uniqueIndex('standups_team_source_event_unique').on(
      table.teamId,
      table.source,
      table.sourceEventId,
    ),
    index('standups_team_date_idx').on(table.teamId, table.workDate),
  ],
);

export const blockers = sqliteTable(
  'blockers',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    standupId: text('standup_id')
      .notNull()
      .references(() => standups.id, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    category: text('category'),
    status: text('status', { enum: ['open', 'resolved'] }).notNull(),
    openedAt: integer('opened_at', { mode: 'timestamp_ms' }).notNull(),
    resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    index('blockers_team_status_idx').on(table.teamId, table.status),
    index('blockers_standup_idx').on(table.standupId),
  ],
);

export const dailySnapshots = sqliteTable(
  'daily_snapshots',
  {
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    workDate: text('work_date').notNull(),
    roster: integer('roster').notNull(),
    posted: integer('posted').notNull(),
    missing: integer('missing').notNull(),
    blocked: integer('blocked').notNull(),
    participationPct: integer('participation_pct').notNull(),
    generatedAt: integer('generated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('daily_snapshots_team_date_unique').on(
      table.teamId,
      table.workDate,
    ),
  ],
);

export const schedulerRuns = sqliteTable(
  'scheduler_runs',
  {
    idempotencyKey: text('idempotency_key').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    job: text('job').notNull(),
    workDate: text('work_date').notNull(),
    scheduledLocalTime: text('scheduled_local_time').notNull(),
    status: text('status', {
      enum: ['running', 'completed', 'failed'],
    }).notNull(),
    attempt: integer('attempt').notNull(),
    leaseUntil: integer('lease_until', { mode: 'timestamp_ms' }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    errorCode: text('error_code'),
  },
  (table) => [
    index('scheduler_runs_team_status_idx').on(table.teamId, table.status),
  ],
);

export const deliveryOutbox = sqliteTable(
  'delivery_outbox',
  {
    id: text('id').primaryKey(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    payloadJson: text('payload_json').notNull(),
    status: text('status', {
      enum: ['pending', 'sent', 'unavailable', 'failed'],
    }).notNull(),
    attempt: integer('attempt').notNull().default(0),
    availableAt: integer('available_at', { mode: 'timestamp_ms' }).notNull(),
    deliveredAt: integer('delivered_at', { mode: 'timestamp_ms' }),
    lastError: text('last_error'),
  },
  (table) => [
    index('delivery_outbox_status_available_idx').on(
      table.status,
      table.availableAt,
    ),
  ],
);

export const databaseSchema = {
  teams,
  members,
  standups,
  blockers,
  dailySnapshots,
  schedulerRuns,
  deliveryOutbox,
};
