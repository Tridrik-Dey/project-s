package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class VerifyOtpChallengeRequest {

    @NotNull(message = "challengeId is required")
    private UUID challengeId;

    @NotBlank(message = "otpCode is required")
    private String otpCode;
}

