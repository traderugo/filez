-- Audit trail for platform staff acting inside a station they do not own.
--
-- lib/stationAccess.js lets role='admin' reach EVERY station, which is what allows an admin
-- to run the setup wizard for an owner they are onboarding. That is a large amount of reach,
-- and the thing that makes it safe is not the permission check but this table: every write
-- an admin makes inside someone else's station leaves a row here.
--
-- Only WRITES are recorded, and only when the acting user neither owns nor staffs the
-- station. Logging reads would bury the real actions under page views on a busy station, and
-- logging an owner's own writes would make the log a duplicate of the data.
--
-- No FK on admin_id or org_id: the log must outlive whatever it describes. A station deleted
-- six months from now should not take the record of what was done to it.
--
-- Text ids to match the rest of this schema. RLS on with no policies — the server reaches it
-- with the service-role key, and nothing client-side should ever read it directly.
--
-- MANUAL MIGRATION: station-portal migrations are applied by hand. Run this on production
-- BEFORE the routes start honouring admin access, or admin-on-behalf writes will happen with
-- no record of them.

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid,                    -- users.id of the acting staff member
  admin_name  text DEFAULT '',         -- denormalised: the log must still read if the account goes
  org_id      uuid,                    -- the station acted upon
  org_name    text DEFAULT '',         -- denormalised for the same reason
  action_type text DEFAULT '',         -- e.g. 'onboarding_saved', 'station_assist'
  target_type text DEFAULT '',
  target_id   text,
  content     text NOT NULL,           -- the sentence that reads after the admin's name
  details     jsonb,                   -- request method + path; NEVER secrets, read back verbatim
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_org ON admin_activity_logs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_logs (admin_id, created_at DESC);

ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;
