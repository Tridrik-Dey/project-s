package com.supplierplatform.revamp.api.dto;

import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.enums.SourceChannel;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class CreateApplicationDraftRequest {

    @NotNull(message = "registryType is required")
    private RegistryType registryType;

    @NotNull(message = "sourceChannel is required")
    private SourceChannel sourceChannel;

    private UUID inviteId;
}

