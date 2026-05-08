package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampApplicationSummaryDto(
        UUID id,
        UUID applicantUserId,
        String registryType,
        String sourceChannel,
        String status,
        String protocolCode,
        Integer currentRevision,
        LocalDateTime submittedAt,
        LocalDateTime updatedAt
) {
}

