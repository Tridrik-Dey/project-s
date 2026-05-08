package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record OtpChallengeVerifyDto(
        UUID challengeId,
        boolean verified,
        String status,
        Integer attempts,
        Integer maxAttempts,
        LocalDateTime verifiedAt
) {
}

