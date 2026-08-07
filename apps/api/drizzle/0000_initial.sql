CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  standup_close_local_time TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY NOT NULL,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  slack_user_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS members_team_slack_user_unique ON members(team_id, slack_user_id);
CREATE INDEX IF NOT EXISTS members_team_active_idx ON members(team_id, active);

CREATE TABLE IF NOT EXISTS standups (
  id TEXT PRIMARY KEY NOT NULL,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  yesterday TEXT NOT NULL,
  today TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('slack', 'dashboard', 'system')),
  source_message_id TEXT,
  source_event_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS standups_team_member_date_unique ON standups(team_id, member_id, work_date);
CREATE UNIQUE INDEX IF NOT EXISTS standups_team_source_event_unique ON standups(team_id, source, source_event_id);
CREATE INDEX IF NOT EXISTS standups_team_date_idx ON standups(team_id, work_date);

CREATE TABLE IF NOT EXISTS blockers (
  id TEXT PRIMARY KEY NOT NULL,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  standup_id TEXT NOT NULL REFERENCES standups(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL CHECK(status IN ('open', 'resolved')),
  opened_at INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS blockers_team_status_idx ON blockers(team_id, status);
CREATE INDEX IF NOT EXISTS blockers_standup_idx ON blockers(standup_id);

CREATE TABLE IF NOT EXISTS daily_snapshots (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  work_date TEXT NOT NULL,
  roster INTEGER NOT NULL,
  posted INTEGER NOT NULL,
  missing INTEGER NOT NULL,
  blocked INTEGER NOT NULL,
  participation_pct INTEGER NOT NULL,
  generated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_snapshots_team_date_unique ON daily_snapshots(team_id, work_date);

CREATE TABLE IF NOT EXISTS scheduler_runs (
  idempotency_key TEXT PRIMARY KEY NOT NULL,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  job TEXT NOT NULL,
  work_date TEXT NOT NULL,
  scheduled_local_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
  attempt INTEGER NOT NULL,
  lease_until INTEGER,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS scheduler_runs_team_status_idx ON scheduler_runs(team_id, status);

CREATE TABLE IF NOT EXISTS delivery_outbox (
  id TEXT PRIMARY KEY NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'unavailable', 'failed')),
  attempt INTEGER NOT NULL DEFAULT 0,
  available_at INTEGER NOT NULL,
  delivered_at INTEGER,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS delivery_outbox_status_available_idx ON delivery_outbox(status, available_at);
