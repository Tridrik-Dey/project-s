package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.Future;

import java.time.LocalDateTime;
import java.util.UUID;

public class AssignReviewCaseRequest {

    private UUID assignedToUserId;

    @Future(message = "slaDueAt must be in the future")
    private LocalDateTime slaDueAt;

    public UUID getAssignedToUserId() {
        return assignedToUserId;
    }

    public void setAssignedToUserId(UUID assignedToUserId) {
        this.assignedToUserId = assignedToUserId;
    }

    public LocalDateTime getSlaDueAt() {
        return slaDueAt;
    }

    public void setSlaDueAt(LocalDateTime slaDueAt) {
        this.slaDueAt = slaDueAt;
    }
}
