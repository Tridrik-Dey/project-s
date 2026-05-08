package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampEvaluationAssignmentDto(
        UUID assignmentId,
        UUID supplierRegistryProfileId,
        UUID assignedEvaluatorUserId,
        String assignedEvaluatorEmail,
        LocalDateTime assignedAt
) {
}
