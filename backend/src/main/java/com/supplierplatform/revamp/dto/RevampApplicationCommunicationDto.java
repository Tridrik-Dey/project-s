package com.supplierplatform.revamp.dto;

import java.time.LocalDateTime;

public record RevampApplicationCommunicationDto(
        String eventKey,
        String message,
        LocalDateTime occurredAt
) {
}
