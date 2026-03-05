-- Prevent duplicate pending subscriptions at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_pending_per_user
  ON subscriptions(user_id) WHERE status = 'pending';
