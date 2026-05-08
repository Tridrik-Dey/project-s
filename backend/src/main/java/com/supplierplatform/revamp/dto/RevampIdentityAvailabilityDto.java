package com.supplierplatform.revamp.dto;

public record RevampIdentityAvailabilityDto(
        boolean available,
        String field,
        String messageKey
) {
}
