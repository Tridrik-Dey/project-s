package com.supplierplatform.revamp.dto;

public record RevampReportKpisDto(
        long totalSuppliers,
        long activeSuppliers,
        long pendingSuppliers,
        long submittedApplications,
        long pendingInvites
) {
}
