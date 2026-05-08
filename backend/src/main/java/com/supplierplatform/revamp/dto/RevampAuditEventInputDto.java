package com.supplierplatform.revamp.dto;

import java.util.UUID;

public record RevampAuditEventInputDto(
        String eventKey,
        String entityType,
        UUID entityId,
        UUID actorUserId,
        String actorRoles,
        String requestId,
        String reason,
        String beforeStateJson,
        String afterStateJson,
        String metadataJson
) {
}

