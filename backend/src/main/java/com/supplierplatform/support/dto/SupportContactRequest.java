package com.supplierplatform.support.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SupportContactRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 120, message = "Name must be at most 120 characters")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Size(max = 190, message = "Email must be at most 190 characters")
    private String email;

    @NotBlank(message = "Message is required")
    @Size(max = 3000, message = "Message must be at most 3000 characters")
    private String message;

    @Size(max = 8, message = "Language must be at most 8 characters")
    private String language;
}

