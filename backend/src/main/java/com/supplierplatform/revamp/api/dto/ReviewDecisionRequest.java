package com.supplierplatform.revamp.api.dto;

import com.supplierplatform.revamp.enums.ReviewDecision;
import jakarta.validation.constraints.NotNull;

public class ReviewDecisionRequest {

    @NotNull
    private ReviewDecision decision;

    private String reason;

    public ReviewDecision getDecision() {
        return decision;
    }

    public void setDecision(ReviewDecision decision) {
        this.decision = decision;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
