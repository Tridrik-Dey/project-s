package com.supplierplatform.revamp.api.dto;

import jakarta.validation.constraints.NotBlank;

public class UpsertNotificationTemplateRequest {

    @NotBlank
    private String content;

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
