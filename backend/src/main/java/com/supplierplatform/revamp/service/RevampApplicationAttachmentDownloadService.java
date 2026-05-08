package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.model.RevampApplicationAttachment;
import com.supplierplatform.revamp.repository.RevampApplicationAttachmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampApplicationAttachmentDownloadService {

    private final RevampApplicationAttachmentRepository attachmentRepository;

    @Value("${app.file.upload-dir}")
    private String uploadDir;

    @Transactional(readOnly = true)
    public AttachmentDownload download(UUID applicationId, String storageKey) {
        String normalizedKey = normalizeStorageKey(storageKey);
        RevampApplicationAttachment attachment = attachmentRepository
                .findFirstByApplicationIdAndStorageKey(applicationId, normalizedKey)
                .orElseThrow(() -> new EntityNotFoundException("RevampApplicationAttachment", applicationId));

        Path uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path filePath = uploadRoot.resolve(normalizedKey).normalize();
        if (!filePath.startsWith(uploadRoot)) {
            throw new AccessDeniedException("Invalid attachment path");
        }
        if (!Files.exists(filePath) || !Files.isRegularFile(filePath)) {
            throw new EntityNotFoundException("Attachment file", applicationId);
        }

        try {
            Resource resource = new UrlResource(filePath.toUri());
            String mimeType = attachment.getMimeType() == null || attachment.getMimeType().isBlank()
                    ? "application/octet-stream"
                    : attachment.getMimeType();
            return new AttachmentDownload(resource, attachment.getFileName(), mimeType);
        } catch (MalformedURLException ex) {
            throw new IllegalStateException("Could not resolve attachment file", ex);
        }
    }

    private String normalizeStorageKey(String storageKey) {
        String normalized = storageKey == null ? "" : storageKey.trim().replace('\\', '/');
        if (normalized.isBlank() || normalized.startsWith("/") || normalized.contains("../") || normalized.contains("..\\")) {
            throw new AccessDeniedException("Invalid attachment path");
        }
        return normalized;
    }

    public record AttachmentDownload(Resource resource, String fileName, String mimeType) {}
}
