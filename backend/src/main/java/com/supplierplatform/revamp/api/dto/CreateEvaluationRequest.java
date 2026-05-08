package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;
import java.util.UUID;

public class CreateEvaluationRequest {

    @NotNull
    private UUID supplierRegistryProfileId;

    @NotBlank
    private String collaborationType;

    @NotBlank
    private String collaborationPeriod;

    private String referenceCode;

    @NotNull
    @Min(1)
    @Max(5)
    private Short overallScore;

    private String comment;

    private Map<String, Short> dimensions;

    public UUID getSupplierRegistryProfileId() {
        return supplierRegistryProfileId;
    }

    public void setSupplierRegistryProfileId(UUID supplierRegistryProfileId) {
        this.supplierRegistryProfileId = supplierRegistryProfileId;
    }

    public String getCollaborationType() {
        return collaborationType;
    }

    public void setCollaborationType(String collaborationType) {
        this.collaborationType = collaborationType;
    }

    public String getCollaborationPeriod() {
        return collaborationPeriod;
    }

    public void setCollaborationPeriod(String collaborationPeriod) {
        this.collaborationPeriod = collaborationPeriod;
    }

    public String getReferenceCode() {
        return referenceCode;
    }

    public void setReferenceCode(String referenceCode) {
        this.referenceCode = referenceCode;
    }

    public Short getOverallScore() {
        return overallScore;
    }

    public void setOverallScore(Short overallScore) {
        this.overallScore = overallScore;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Map<String, Short> getDimensions() {
        return dimensions;
    }

    public void setDimensions(Map<String, Short> dimensions) {
        this.dimensions = dimensions;
    }
}
