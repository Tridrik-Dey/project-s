package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ForgotPasswordRequestDto {

    @NotBlank(message = "email is required")
    @Email(message = "email must be valid")
    private String email;
}
