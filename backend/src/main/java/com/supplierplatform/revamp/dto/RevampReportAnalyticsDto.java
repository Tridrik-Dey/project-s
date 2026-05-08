package com.supplierplatform.revamp.dto;

import java.util.List;

public record RevampReportAnalyticsDto(
        RevampReportKpisDto kpis,
        long alboAActive,
        long alboBActive,
        long newRegistrationsYtd,
        long evaluationsYtd,
        double approvalRatePct,
        List<MonthlyPointDto> monthlyPoints,
        List<TopicRankingRowDto> thematicRanking,
        List<DistributionRowDto> distribution,
        List<TopSupplierRowDto> topSuppliers
) {
    public record MonthlyPointDto(
            String monthLabel,
            long alboA,
            long alboB
    ) {
    }

    public record TopicRankingRowDto(
            String label,
            long value,
            int percentage
    ) {
    }

    public record DistributionRowDto(
            String label,
            long value
    ) {
    }

    public record TopSupplierRowDto(
            String name,
            String subtitle,
            double averageScore,
            long evaluationsCount
    ) {
    }
}

