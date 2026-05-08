package com.supplierplatform.search.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdvancedSearchCriterionRequest {

    @NotBlank(message = "Field key is required")
    private String fieldKey;

    @NotBlank(message = "Field value is required")
    private String value;
}
