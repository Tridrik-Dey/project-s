package com.supplierplatform.revamp.api.dto;

import com.supplierplatform.revamp.enums.RegistryType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateInviteRequest {

    @NotNull(message = "registryType is required")
    private RegistryType registryType;

    @NotNull(message = "invitedEmail is required")
    @Email(message = "invitedEmail must be a valid email")
    private String invitedEmail;

    private String invitedName;

    @Min(value = 1, message = "expiresInDays must be at least 1")
    @Max(value = 365, message = "expiresInDays must be at most 365")
    private Integer expiresInDays;

    private String note;
}
