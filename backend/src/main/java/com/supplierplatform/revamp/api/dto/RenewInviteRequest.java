package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RenewInviteRequest {
    @Min(value = 1, message = "expiresInDays must be at least 1")
    @Max(value = 365, message = "expiresInDays must be at most 365")
    private Integer expiresInDays;
}

