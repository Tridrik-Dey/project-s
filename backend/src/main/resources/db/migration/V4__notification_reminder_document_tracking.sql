-- Track document-level reminder sends to prevent duplicate emails

ALTER TABLE notification_reminders
    ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES supplier_documents(id);

ALTER TABLE notification_reminders
    ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_reminder_document
    ON notification_reminders(document_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_doc_expiry_reminder_supplier_document_recipient
    ON notification_reminders(supplier_id, document_id, reminder_type, recipient_email)
    WHERE is_dismissed = FALSE;
