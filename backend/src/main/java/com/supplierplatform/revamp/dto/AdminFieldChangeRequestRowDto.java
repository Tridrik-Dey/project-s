package com.supplierplatform.revamp.dto;

import com.supplierplatform.revamp.enums.FieldChangeRequestStatus;
import com.supplierplatform.revamp.enums.RegistryType;

import java.time.LocalDateTime;
import java.util.UUID;

public record AdminFieldChangeRequestRowDto(
        UUID id,
        UUID applicationId,
        UUID profileId,
        String protocolCode,
        RegistryType registryType,
        String supplierDisplayName,
        String supplierEmail,
        String sectionKey,
        String supplierMessage,
        FieldChangeRequestStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
