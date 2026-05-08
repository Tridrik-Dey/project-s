package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record RevampEvaluationHistoryItemDto(
        UUID evaluationId,
        LocalDateTime createdAt,
        String collaborationType,
        String collaborationPeriod,
        String referenceCode,
        String comment,
        double averageScore,
        Map<String, Double> dimensionScores,
        String evaluatorAlias
) {
}

