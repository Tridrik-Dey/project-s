package com.supplierplatform.revamp.dto;

import com.supplierplatform.revamp.enums.FieldChangeRequestStatus;

import java.time.LocalDateTime;
import java.util.UUID;

public record FieldChangeRequestDto(
        UUID id,
        UUID applicationId,
        String sectionKey,
        String supplierMessage,
        FieldChangeRequestStatus status,
        String adminNote,
        String unlockedByUserEmail,
        LocalDateTime unlockedAt,
        LocalDateTime submittedAt,
        String beforeValueJson,
        String afterValueJson,
        UUID reviewCaseId,
        String decisionReason,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
