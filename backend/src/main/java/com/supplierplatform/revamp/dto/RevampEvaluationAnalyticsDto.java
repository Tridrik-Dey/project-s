package com.supplierplatform.revamp.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record RevampEvaluationAnalyticsDto(
        UUID supplierRegistryProfileId,
        String supplierName,
        String supplierType,
        long totalEvaluations,
        double averageOverallScore,
        Map<String, Double> dimensionAverages,
        Map<Integer, Long> scoreDistribution,
        List<RevampEvaluationHistoryItemDto> history
) {
}

