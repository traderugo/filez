-- Backfill org_id on existing subscriptions where it's NULL.
-- Set it to the owner's first organization.

UPDATE subscriptions s
SET org_id = (
  SELECT o.id
  FROM organizations o
  WHERE o.owner_id = s.user_id
  ORDER BY o.created_at ASC
  LIMIT 1
)
WHERE s.org_id IS NULL;
