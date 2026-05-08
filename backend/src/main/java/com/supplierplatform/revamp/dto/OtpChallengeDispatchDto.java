package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record OtpChallengeDispatchDto(
        UUID challengeId,
        LocalDateTime expiresAt,
        String status,
        String deliveryMode,
        String targetEmailMasked,
        String debugCode
) {
}

