package com.supplierplatform.revamp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ComposeEmailRequest(
        @NotBlank(message = "Subject is required")
        @Size(max = 200, message = "Subject must not exceed 200 characters")
        String subject,

        @NotBlank(message = "Body is required")
        @Size(max = 5000, message = "Body must not exceed 5000 characters")
        String body
) {
}
