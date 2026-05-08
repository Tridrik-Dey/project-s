package com.supplierplatform.search.dto;

import lombok.Builder;

import java.util.Map;
import java.util.UUID;

@Builder
public record SearchResultRowResponse(
        UUID supplierId,
        String status,
        Map<String, String> values
) {
}
