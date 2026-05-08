package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record RevampEvaluationOverviewRowDto(
        UUID evaluationId,
        UUID supplierRegistryProfileId,
        String supplierName,
        String supplierType,
        String protocolCode,
        LocalDateTime createdAt,
        String collaborationType,
        String collaborationPeriod,
        String referenceCode,
        String comment,
        String evaluatorDisplay,
        double averageScore,
        long evaluationCount,
        Map<String, Double> dimensionScores
) {
}
