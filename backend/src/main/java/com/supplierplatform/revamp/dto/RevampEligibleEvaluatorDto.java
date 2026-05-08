package com.supplierplatform.revamp.dto;

import com.supplierplatform.revamp.enums.AdminRole;

import java.util.UUID;

public record RevampEligibleEvaluatorDto(
        UUID userId,
        String email,
        AdminRole adminRole
) {
}
