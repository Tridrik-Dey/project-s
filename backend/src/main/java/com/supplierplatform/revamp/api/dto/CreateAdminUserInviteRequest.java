package com.supplierplatform.revamp.api.dto;

import com.supplierplatform.revamp.enums.AdminRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateAdminUserInviteRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Pattern(
            regexp = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$",
            message = "Email must include a valid domain suffix (e.g. .com, .it)"
    )
    private String email;

    @NotNull(message = "Admin governance role is required")
    private AdminRole adminRole;

    @Min(value = 1, message = "Expiry days must be at least 1")
    @Max(value = 30, message = "Expiry days must be at most 30")
    private Integer expiresInDays = 7;
}
