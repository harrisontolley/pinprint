-- 0008_transactional_emails.sql — claim columns for the two new post-payment
-- emails: order confirmation (fired from the paid transition) and
-- shipped/delivered notifications (fired from Artelo status transitions).
--
-- Same idempotency shape as 0005_digital_delivery.sql's digital_delivered_at:
-- each column is set exactly once, by an atomic "update ... where col is
-- null" claim (see claimConfirmationEmail / claimShipmentEmail in orders.ts),
-- so a Stripe/Artelo webhook retry (or the fulfillment-sweep cron re-running
-- the same order) can never send the same email twice. Safe to re-run
-- (IF NOT EXISTS throughout).

alter table orders add column if not exists confirmation_email_sent_at timestamptz;
alter table orders add column if not exists shipped_email_sent_at timestamptz;
alter table orders add column if not exists delivered_email_sent_at timestamptz;
