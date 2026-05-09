package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.dto.DocumentRenewalRequestDto;
import com.supplierplatform.revamp.service.RevampDocumentRenewalRequestService;
import com.supplierplatform.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/document-renewal-requests")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class RevampDocumentRenewalRequestController {

    private final RevampDocumentRenewalRequestService renewalService;
    private final RevampAccessGuard revampAccessGuard;

    @GetMapping("/applications/{applicationId}")
    public ResponseEntity<ApiResponse<List<DocumentRenewalRequestDto>>> listForApplication(
            @PathVariable UUID applicationId
    ) {
        revampAccessGuard.requireReadEnabled();
        User currentUser = getCurrentUser();
        return ResponseEntity.ok(ApiResponse.ok(renewalService.listForApplication(applicationId, currentUser.getId())));
    }

    @PostMapping("/{renewalId}/submit")
    public ResponseEntity<ApiResponse<DocumentRenewalRequestDto>> submit(@PathVariable UUID renewalId) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        DocumentRenewalRequestDto dto = renewalService.submitRenewal(renewalId, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.ok("Document renewal submitted for review", dto));
    }

    @PostMapping("/applications/{applicationId}/batches/{batchId}/submit")
    public ResponseEntity<ApiResponse<List<DocumentRenewalRequestDto>>> submitBatch(
            @PathVariable UUID applicationId,
            @PathVariable String batchId
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        List<DocumentRenewalRequestDto> dto = renewalService.submitBatch(applicationId, batchId, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.ok("Document renewal batch submitted for review", dto));
    }

    private User getCurrentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }
}
