package com.supplierplatform.revamp.dto;

import java.time.LocalDate;

public record RevampReportFilterParams(
        Integer year,
        LocalDate periodFrom,
        LocalDate periodTo,
        String registryType,
        String groupCompany,
        String category,
        String profileStatus,
        String ratingBand
) {
}
