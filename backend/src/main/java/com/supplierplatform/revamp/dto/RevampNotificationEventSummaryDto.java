package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampNotificationEventSummaryDto(
        UUID id,
        String eventKey,
        String entityType,
        UUID entityId,
        String recipient,
        String templateKey,
        Integer templateVersion,
        String deliveryStatus,
        Integer retryCount,
        LocalDateTime createdAt,
        LocalDateTime sentAt
) {
}
