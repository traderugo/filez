-- One close-of-business entry per station per day.
--
-- Duplicate-prevention for daily sales previously ran only against each device's local Dexie
-- mirror, which can be stale. An offline / out-of-date device could not see a day's existing
-- entry and so created a SECOND close-of-business row for it (this is what produced the
-- duplicate daily-sales rows on days entered twice from different devices, which then inflated
-- the reports). This enforces the rule at the database level, where a stale client cannot
-- bypass it. Multiple non-close-of-business SHIFT entries per day are still allowed.
--
-- IMPORTANT: any existing duplicate live close-of-business rows must be soft-deleted BEFORE
-- running this migration, otherwise the index creation fails with a uniqueness error. Find them
-- with:
--   SELECT org_id, entry_date, count(*) FROM daily_sales_entries
--   WHERE close_of_business IS TRUE AND deleted_at IS NULL
--   GROUP BY org_id, entry_date HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_sales_one_cob_per_day
  ON daily_sales_entries (org_id, entry_date)
  WHERE close_of_business IS TRUE AND deleted_at IS NULL;
