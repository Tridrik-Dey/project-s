package com.supplierplatform.revamp.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AttachmentUploadResponse {
    private String storageKey;
    private String fileName;
    private String mimeType;
    private long sizeBytes;
}
