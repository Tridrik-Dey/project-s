ALTER TABLE notification_events
    ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(1000);
