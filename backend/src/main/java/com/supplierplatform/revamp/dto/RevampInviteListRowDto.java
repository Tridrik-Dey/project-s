package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampInviteListRowDto(
        UUID id,
        String invitedName,
        String invitedEmail,
        String registryType,
        String inviteStatus,
        String uiStatus,
        int progressPercent,
        LocalDateTime createdAt,
        LocalDateTime expiresAt,
        String invitedByName,
        String note,
        UUID applicationId,
        String profilePath,
        boolean canRenew,
        boolean canOpenProfile
) {
}
