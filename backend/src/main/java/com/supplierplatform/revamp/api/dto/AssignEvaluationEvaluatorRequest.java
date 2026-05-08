package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.UUID;

public class AssignEvaluationEvaluatorRequest {

    @NotNull
    private UUID evaluatorUserId;

    private String reason;

    private LocalDateTime dueAt;

    public UUID getEvaluatorUserId() {
        return evaluatorUserId;
    }

    public void setEvaluatorUserId(UUID evaluatorUserId) {
        this.evaluatorUserId = evaluatorUserId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public LocalDateTime getDueAt() {
        return dueAt;
    }

    public void setDueAt(LocalDateTime dueAt) {
        this.dueAt = dueAt;
    }
}
