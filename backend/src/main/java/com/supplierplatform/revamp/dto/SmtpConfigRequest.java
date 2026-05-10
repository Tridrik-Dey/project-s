package com.supplierplatform.revamp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record SmtpConfigRequest(
        @NotBlank @Email String email,
        String password,
        Boolean debugOtpEnabled
) {}
