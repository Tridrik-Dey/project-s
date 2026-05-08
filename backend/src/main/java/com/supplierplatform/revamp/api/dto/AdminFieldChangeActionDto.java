package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminFieldChangeActionDto {

    @Size(max = 2000)
    private String adminNote;
}
