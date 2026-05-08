package com.supplierplatform.revamp.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.supplierplatform.revamp.enums.RegistryProfileStatus;
import com.supplierplatform.revamp.enums.RegistryType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record RevampSupplierProfileDto(
        UUID id,
        UUID applicationId,
        UUID supplierUserId,
        String supplierEmail,
        RegistryType registryType,
        RegistryProfileStatus status,
        String displayName,
        String publicSummary,
        BigDecimal aggregateScore,
        boolean visible,
        LocalDateTime approvedAt,
        LocalDateTime expiresAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        JsonNode publicCardView,
        JsonNode adminCardView
) {
}
