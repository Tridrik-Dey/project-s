package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public class ReviewIntegrationRequest {

    @NotNull(message = "dueAt is required")
    @Future(message = "dueAt must be in the future")
    private LocalDateTime dueAt;

    @NotBlank(message = "message is required")
    private String message;

    private String requestedItemsJson;

    public LocalDateTime getDueAt() {
        return dueAt;
    }

    public void setDueAt(LocalDateTime dueAt) {
        this.dueAt = dueAt;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getRequestedItemsJson() {
        return requestedItemsJson;
    }

    public void setRequestedItemsJson(String requestedItemsJson) {
        this.requestedItemsJson = requestedItemsJson;
    }
}
