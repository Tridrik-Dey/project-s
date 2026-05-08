package com.supplierplatform.revamp.dto;

import java.util.List;

public record RevampEvaluationOverviewDto(
        long totalEvaluations,
        double averageOverallScore,
        long currentMonthEvaluations,
        long evaluatedSuppliers,
        List<RevampEvaluationOverviewRowDto> rows
) {
}

