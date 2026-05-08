package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class SaveEvaluationDraftRequest {
    @Min(1)
    @Max(5)
    private Short overallScore;
    private Map<String, Short> dimensions;
    private String collaborationType;
    private String collaborationPeriod;
    private String referenceCode;
    private String comment;
}
