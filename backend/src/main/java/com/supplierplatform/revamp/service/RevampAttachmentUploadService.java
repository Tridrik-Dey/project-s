package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.api.dto.AttachmentUploadResponse;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampAttachmentUploadService {

    private final RevampApplicationRepository applicationRepository;

    @Value("${app.file.upload-dir}")
    private String uploadDir;

    public AttachmentUploadResponse upload(UUID applicationId, MultipartFile file, UUID currentUserId) {
        RevampApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampApplication", applicationId));

        if (!application.getApplicantUser().getId().equals(currentUserId)) {
            throw new AccessDeniedException("Not authorized to upload to this application");
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String cleanedName = StringUtils.cleanPath(originalFilename);
        String baseName = Paths.get(cleanedName).getFileName().toString().replaceAll("[\\\\/:*?\"<>|]", "_");
        String storedFilename = UUID.randomUUID() + "_" + baseName;
        String storageKey = "revamp/" + applicationId + "/" + storedFilename;

        Path uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path targetDir = uploadRoot.resolve("revamp").resolve(applicationId.toString());

        try {
            Files.createDirectories(targetDir);
            file.transferTo(targetDir.resolve(storedFilename).toFile());
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file: " + e.getMessage(), e);
        }

        return new AttachmentUploadResponse(
                storageKey,
                baseName,
                file.getContentType() != null ? file.getContentType() : "application/octet-stream",
                file.getSize()
        );
    }
}
