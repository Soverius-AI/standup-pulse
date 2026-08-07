ALTER TABLE standups ADD COLUMN source_event_id TEXT;
DROP INDEX IF EXISTS standups_source_message_unique;
CREATE UNIQUE INDEX IF NOT EXISTS standups_team_source_event_unique ON standups(team_id, source, source_event_id);
