package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.AttachmentUploadResponse;
import com.supplierplatform.revamp.api.dto.CreateApplicationDraftRequest;
import com.supplierplatform.revamp.api.dto.SaveApplicationSectionRequest;
import com.supplierplatform.revamp.dto.RevampApplicationSummaryDto;
import com.supplierplatform.revamp.dto.RevampApplicationCommunicationDto;
import com.supplierplatform.revamp.dto.RevampIntegrationRequestSummaryDto;
import com.supplierplatform.revamp.dto.RevampIdentityAvailabilityDto;
import com.supplierplatform.revamp.dto.RevampSectionSnapshotDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAggregateDto;
import com.supplierplatform.revamp.service.RevampApplicationAttachmentDownloadService;
import com.supplierplatform.revamp.service.RevampApplicationService;
import com.supplierplatform.revamp.service.RevampAttachmentUploadService;
import com.supplierplatform.revamp.service.RevampEvaluationService;
import com.supplierplatform.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/applications")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class RevampApplicationController {

    private final RevampApplicationService applicationService;
    private final RevampApplicationAttachmentDownloadService attachmentDownloadService;
    private final RevampAttachmentUploadService attachmentUploadService;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampEvaluationService evaluationService;

    @PostMapping
    public ResponseEntity<ApiResponse<RevampApplicationSummaryDto>> createDraft(
            @Valid @RequestBody CreateApplicationDraftRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        RevampApplicationSummaryDto dto = applicationService.createDraft(
                currentUser.getId(),
                request.getRegistryType(),
                request.getSourceChannel(),
                request.getInviteId()
        );
        return ResponseEntity.ok(ApiResponse.ok("Draft created", dto));
    }

    @GetMapping("/{applicationId}")
    public ResponseEntity<ApiResponse<RevampApplicationSummaryDto>> getSummary(@PathVariable UUID applicationId) {
        revampAccessGuard.requireReadEnabled();
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getSummary(applicationId)));
    }

    @GetMapping("/me/evaluation-aggregate")
    public ResponseEntity<ApiResponse<RevampEvaluationAggregateDto>> getMyEvaluationAggregate() {
        revampAccessGuard.requireReadEnabled();
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(ApiResponse.ok(evaluationService.getAggregateForSupplierUser(currentUser.getId())));
    }

    @GetMapping("/me/latest")
    public ResponseEntity<ApiResponse<RevampApplicationSummaryDto>> getMyLatest() {
        revampAccessGuard.requireReadEnabled();
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getLatestForApplicant(currentUser.getId())));
    }

    @GetMapping("/{applicationId}/sections")
    public ResponseEntity<ApiResponse<List<RevampSectionSnapshotDto>>> getSections(@PathVariable UUID applicationId) {
        revampAccessGuard.requireReadEnabled();
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getLatestSections(applicationId)));
    }

    @GetMapping("/{applicationId}/identity/check")
    public ResponseEntity<ApiResponse<RevampIdentityAvailabilityDto>> checkIdentityAvailability(
            @PathVariable UUID applicationId,
            @RequestParam String field,
            @RequestParam String value
    ) {
        revampAccessGuard.requireReadEnabled();
        return ResponseEntity.ok(ApiResponse.ok(applicationService.checkIdentityAvailability(applicationId, field, value)));
    }

    @DeleteMapping("/{applicationId}/draft")
    public ResponseEntity<ApiResponse<Void>> deleteOwnDraft(@PathVariable UUID applicationId) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        applicationService.deleteOwnDraft(applicationId, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.ok("Draft deleted", null));
    }

    @GetMapping("/{applicationId}/communications")
    public ResponseEntity<ApiResponse<List<RevampApplicationCommunicationDto>>> getCommunications(@PathVariable UUID applicationId) {
        revampAccessGuard.requireReadEnabled();
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getCommunications(applicationId, currentUser.getId())));
    }

    @GetMapping("/{applicationId}/integration-request/open")
    public ResponseEntity<ApiResponse<RevampIntegrationRequestSummaryDto>> getOpenIntegrationRequest(@PathVariable UUID applicationId) {
        revampAccessGuard.requireReadEnabled();
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(ApiResponse.ok(applicationService.getOpenIntegrationRequest(applicationId, currentUser.getId())));
    }

    @PostMapping("/{applicationId}/attachments/upload")
    public ResponseEntity<ApiResponse<AttachmentUploadResponse>> uploadAttachment(
            @PathVariable UUID applicationId,
            @RequestParam("file") MultipartFile file
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        AttachmentUploadResponse response = attachmentUploadService.upload(applicationId, file, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.ok("File uploaded", response));
    }

    @GetMapping("/{applicationId}/attachments/download")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable UUID applicationId,
            @RequestParam String storageKey
    ) {
        revampAccessGuard.requireReadEnabled();
        RevampApplicationAttachmentDownloadService.AttachmentDownload download =
                attachmentDownloadService.download(applicationId, storageKey);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.mimeType()))
                .header(
                        "Content-Disposition",
                        ContentDisposition.inline()
                                .filename(download.fileName(), StandardCharsets.UTF_8)
                                .build()
                                .toString()
                )
                .body(download.resource());
    }

    @PutMapping("/{applicationId}/sections/{sectionKey}")
    public ResponseEntity<ApiResponse<RevampSectionSnapshotDto>> saveSection(
            @PathVariable UUID applicationId,
            @PathVariable String sectionKey,
            @RequestBody SaveApplicationSectionRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        RevampSectionSnapshotDto dto = applicationService.saveLatestSection(
                applicationId,
                sectionKey,
                request.getPayloadJson(),
                Boolean.TRUE.equals(request.getCompleted())
        );
        return ResponseEntity.ok(ApiResponse.ok("Section saved", dto));
    }

    @PostMapping("/{applicationId}/submit")
    public ResponseEntity<ApiResponse<RevampApplicationSummaryDto>> submit(@PathVariable UUID applicationId) {
        revampAccessGuard.requireWriteEnabled();
        return ResponseEntity.ok(ApiResponse.ok("Application submitted", applicationService.submit(applicationId)));
    }

    @PostMapping("/{applicationId}/integration-response")
    public ResponseEntity<ApiResponse<RevampApplicationSummaryDto>> answerIntegration(@PathVariable UUID applicationId) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(ApiResponse.ok(
                "Integration response submitted",
                applicationService.answerIntegration(applicationId, currentUser.getId())
        ));
    }

    @PostMapping("/{applicationId}/integration-response/items/{itemCode}/complete")
    public ResponseEntity<ApiResponse<RevampApplicationSummaryDto>> completeIntegrationItem(
            @PathVariable UUID applicationId,
            @PathVariable String itemCode
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(ApiResponse.ok(
                "Integration item completed",
                applicationService.completeIntegrationItem(applicationId, currentUser.getId(), itemCode)
        ));
    }

    private User getCurrentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
