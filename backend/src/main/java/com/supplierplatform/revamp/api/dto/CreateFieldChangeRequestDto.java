package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateFieldChangeRequestDto {

    @NotBlank
    @Size(max = 32)
    private String sectionKey;

    @NotBlank
    @Size(max = 2000)
    private String supplierMessage;
}
