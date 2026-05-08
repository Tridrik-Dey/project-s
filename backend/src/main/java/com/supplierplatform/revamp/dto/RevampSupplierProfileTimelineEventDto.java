package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampSupplierProfileTimelineEventDto(
        UUID id,
        String eventKey,
        UUID actorUserId,
        String actorRoles,
        String reason,
        String beforeStateJson,
        String afterStateJson,
        String metadataJson,
        LocalDateTime occurredAt
) {
}

