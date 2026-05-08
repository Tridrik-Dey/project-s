package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampSectionSnapshotDto(
        UUID id,
        UUID applicationId,
        String sectionKey,
        Integer sectionVersion,
        boolean completed,
        String payloadJson,
        LocalDateTime updatedAt
) {
}

