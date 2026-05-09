package com.supplierplatform.revamp.dto;

import com.supplierplatform.revamp.enums.DocumentRenewalRequestStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public record DocumentRenewalRequestDto(
        UUID id,
        UUID applicationId,
        UUID reviewCaseId,
        String sectionKey,
        String batchId,
        String documentType,
        String documentLabel,
        String integrationItemCode,
        String certificationKey,
        LocalDate expiryDate,
        DocumentRenewalRequestStatus status,
        String oldAttachmentJson,
        String newAttachmentJson,
        LocalDateTime submittedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        boolean expiredWithoutResponse
) {
}
