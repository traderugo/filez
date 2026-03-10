-- Add is_pour_back flag to consumption entries
-- When true, the entry represents a pour back instead of consumption

ALTER TABLE consumption_entries ADD COLUMN is_pour_back boolean NOT NULL DEFAULT false;
