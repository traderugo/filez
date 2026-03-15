-- Add deleted_at column to station_messages for soft-delete support
-- Also allow content to be nullable (null = deleted message)

ALTER TABLE station_messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE station_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
