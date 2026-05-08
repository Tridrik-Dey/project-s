package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
public class ReassignEvaluationRequest {
    @NotNull
    private UUID evaluatorUserId;

    private LocalDateTime dueAt;

    @NotNull
    private String reason;
}
