package com.supplierplatform.revamp.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.LocalDateTime;
import java.util.UUID;

public record RevampIntegrationRequestSummaryDto(
        UUID id,
        UUID reviewCaseId,
        String status,
        LocalDateTime dueAt,
        String requestMessage,
        JsonNode requestedItemsJson,
        LocalDateTime updatedAt
) {
}

