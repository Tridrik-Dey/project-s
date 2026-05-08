package com.supplierplatform.search.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class AdvancedSearchRequest {

    @Valid
    @NotEmpty(message = "At least one search criterion is required")
    private List<AdvancedSearchCriterionRequest> criteria;

    private Integer page = 0;
    private Integer size = 20;
}
