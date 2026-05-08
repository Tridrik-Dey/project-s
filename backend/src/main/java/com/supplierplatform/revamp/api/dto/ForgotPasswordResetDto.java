package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class ForgotPasswordResetDto {

    @NotNull(message = "challengeId is required")
    private UUID challengeId;

    @NotBlank(message = "otpCode is required")
    private String otpCode;

    @NotBlank(message = "newPassword is required")
    @Size(min = 8, message = "newPassword must be at least 8 characters")
    private String newPassword;
}
