-- Add deleted_at column to station_messages for soft-delete support
-- Also allow content to be nullable (null = deleted message)
--
-- The CREATE below is a repair, not new work. station_messages was created directly against
-- production and never written as a migration, so this file ALTERed a table that nothing in
-- supabase/migrations/ ever made. Applying the folder to a fresh database failed here with
-- 42P01 "relation station_messages does not exist", which is how it was found: rebuilding the
-- schema after the public schema was dropped.
--
-- It belongs here rather than in a later migration because 034+ would run after these ALTERs.
-- Shape is taken from the contract documented in app/api/chat/route.js and confirmed against
-- the live rows. IF NOT EXISTS so this stays a no-op on every database that already has it.

CREATE TABLE IF NOT EXISTS station_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id),
  user_name    TEXT,
  type         TEXT NOT NULL DEFAULT 'message',   -- 'message' | 'activity'
  content      TEXT,                              -- nullable (null = deleted)
  action_type  TEXT,                              -- e.g. 'created_entry', 'left_station'
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_station_messages_org_created
  ON station_messages (org_id, created_at DESC);

-- Locked with no policies: the chat API reaches this table with the service-role key.
ALTER TABLE station_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE station_messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE station_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
