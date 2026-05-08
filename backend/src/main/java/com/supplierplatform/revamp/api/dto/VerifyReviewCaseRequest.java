package com.supplierplatform.revamp.api.dto;

import com.supplierplatform.revamp.enums.VerificationOutcome;
import jakarta.validation.constraints.Size;

public class VerifyReviewCaseRequest {

    @Size(max = 1000, message = "Verification note must not exceed 1000 characters")
    private String verificationNote;
    private VerificationOutcome verificationOutcome;

    public String getVerificationNote() {
        return verificationNote;
    }

    public void setVerificationNote(String verificationNote) {
        this.verificationNote = verificationNote;
    }

    public VerificationOutcome getVerificationOutcome() {
        return verificationOutcome;
    }

    public void setVerificationOutcome(VerificationOutcome verificationOutcome) {
        this.verificationOutcome = verificationOutcome;
    }
}
