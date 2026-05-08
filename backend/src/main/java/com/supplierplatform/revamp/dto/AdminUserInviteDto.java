package com.supplierplatform.revamp.dto;

import com.supplierplatform.revamp.enums.AdminRole;

import java.time.LocalDateTime;
import java.util.UUID;

public record AdminUserInviteDto(
        UUID userId,
        String email,
        AdminRole adminRole,
        LocalDateTime inviteExpiresAt,
        boolean mailSent,
        String activationUrl
) {
    public AdminUserInviteDto(
            UUID userId,
            String email,
            AdminRole adminRole,
            LocalDateTime inviteExpiresAt
    ) {
        this(userId, email, adminRole, inviteExpiresAt, true, null);
    }
}
