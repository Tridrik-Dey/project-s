package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampReviewCaseSummaryDto(
        UUID id,
        UUID applicationId,
        String protocolCode,
        String status,
        String decision,
        UUID assignedToUserId,
        String assignedToDisplayName,
        LocalDateTime assignedAt,
        LocalDateTime slaDueAt,
        UUID verifiedByUserId,
        String verifiedByDisplayName,
        LocalDateTime verifiedAt,
        String verificationNote,
        String verificationOutcome,
        UUID decidedByUserId,
        String decidedByDisplayName,
        LocalDateTime decidedAt,
        String latestIntegrationRequestStatus,
        LocalDateTime latestIntegrationSupplierRespondedAt,
        LocalDateTime updatedAt,
        String registryType,
        String applicantDisplayName
) {
    public RevampReviewCaseSummaryDto(
            UUID id,
            UUID applicationId,
            String status,
            String decision,
            UUID assignedToUserId,
            String assignedToDisplayName,
            LocalDateTime assignedAt,
            LocalDateTime slaDueAt,
            UUID verifiedByUserId,
            String verifiedByDisplayName,
            LocalDateTime verifiedAt,
            String verificationNote,
            String verificationOutcome,
            LocalDateTime updatedAt
    ) {
        this(
                id,
                applicationId,
                null,
                status,
                decision,
                assignedToUserId,
                assignedToDisplayName,
                assignedAt,
                slaDueAt,
                verifiedByUserId,
                verifiedByDisplayName,
                verifiedAt,
                verificationNote,
                verificationOutcome,
                null,
                null,
                null,
                null,
                null,
                updatedAt,
                null,
                null
        );
    }
}
