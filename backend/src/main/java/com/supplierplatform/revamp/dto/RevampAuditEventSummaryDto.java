package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampAuditEventSummaryDto(
        UUID id,
        String eventKey,
        String entityType,
        UUID entityId,
        UUID actorUserId,
        String actorRoles,
        String requestId,
        String reason,
        String beforeStateJson,
        String afterStateJson,
        String metadataJson,
        LocalDateTime occurredAt
) {
}
