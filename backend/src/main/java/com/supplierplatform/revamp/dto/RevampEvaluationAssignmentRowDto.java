package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampEvaluationAssignmentRowDto(
        UUID assignmentId,
        UUID supplierRegistryProfileId,
        String supplierName,
        String supplierType,
        UUID assignedEvaluatorUserId,
        String assignedEvaluatorEmail,
        LocalDateTime assignedAt,
        UUID evaluationId,
        Short evaluationScore,
        LocalDateTime evaluatedAt
) {
}
