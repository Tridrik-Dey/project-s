package com.supplierplatform.revamp.dto;

public record RevampInviteReminderRunDto(
        int scanned,
        int sent,
        int skippedDuplicate,
        int failed,
        int expired,
        int expiryNotified
) {
    public RevampInviteReminderRunDto(int scanned, int sent, int skippedDuplicate, int failed) {
        this(scanned, sent, skippedDuplicate, failed, 0, 0);
    }
}
