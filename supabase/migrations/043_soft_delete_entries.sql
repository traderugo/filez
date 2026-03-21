-- Add deleted_at column to all 6 entry tables for soft-delete support.
-- This enables the poll endpoint to propagate deletions across devices.

ALTER TABLE daily_sales_entries ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE product_receipt_entries ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE lodgement_entries ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE lube_sales_entries ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE lube_stock_entries ADD COLUMN deleted_at timestamptz DEFAULT NULL;
ALTER TABLE customer_payment_entries ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Index for efficient polling: find soft-deleted records by updated_at
CREATE INDEX idx_daily_sales_deleted ON daily_sales_entries(updated_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_product_receipt_deleted ON product_receipt_entries(updated_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_lodgement_deleted ON lodgement_entries(updated_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_lube_sales_deleted ON lube_sales_entries(updated_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_lube_stock_deleted ON lube_stock_entries(updated_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_customer_payment_deleted ON customer_payment_entries(updated_at) WHERE deleted_at IS NOT NULL;
