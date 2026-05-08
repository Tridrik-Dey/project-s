package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class SendOtpChallengeRequest {

    @NotNull(message = "applicationId is required")
    private UUID applicationId;
}

