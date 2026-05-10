package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.AdminFieldChangeActionDto;
import com.supplierplatform.revamp.api.dto.CreateFieldChangeRequestDto;
import com.supplierplatform.revamp.dto.AdminFieldChangeRequestRowDto;
import com.supplierplatform.revamp.dto.FieldChangeRequestDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampFieldChangeRequestService;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/field-change-requests")
@PreAuthorize("isAuthenticated()")
@RequiredArgsConstructor
public class RevampFieldChangeRequestController {

    private final RevampFieldChangeRequestService fcrService;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    // ── Supplier: create a change request ──────────────────────────────────

    @PostMapping("/applications/{applicationId}")
    public ResponseEntity<ApiResponse<FieldChangeRequestDto>> createRequest(
            @PathVariable UUID applicationId,
            @Valid @RequestBody CreateFieldChangeRequestDto request
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        FieldChangeRequestDto dto = fcrService.createRequest(
                applicationId,
                currentUser.getId(),
                request.getSectionKey(),
                request.getSupplierMessage()
        );
        return ResponseEntity.ok(ApiResponse.ok("Field change request submitted", dto));
    }

    // ── Both: list all FCRs for an application ─────────────────────────────

    @GetMapping("/admin/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<AdminFieldChangeRequestRowDto>>> listPendingForAdmin() {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        return ResponseEntity.ok(ApiResponse.ok(fcrService.listPendingForAdmin()));
    }

    @GetMapping("/applications/{applicationId}")
    public ResponseEntity<ApiResponse<List<FieldChangeRequestDto>>> listForApplication(
            @PathVariable UUID applicationId
    ) {
        revampAccessGuard.requireReadEnabled();
        return ResponseEntity.ok(ApiResponse.ok(fcrService.listForApplication(applicationId)));
    }

    // ── Both: get a single FCR ─────────────────────────────────────────────

    @GetMapping("/{fcrId}")
    public ResponseEntity<ApiResponse<FieldChangeRequestDto>> getById(@PathVariable UUID fcrId) {
        revampAccessGuard.requireReadEnabled();
        return ResponseEntity.ok(ApiResponse.ok(fcrService.getById(fcrId)));
    }

    // ── Admin: unlock the section ──────────────────────────────────────────

    @PostMapping("/{fcrId}/unlock")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<FieldChangeRequestDto>> unlock(
            @PathVariable UUID fcrId,
            @Valid @RequestBody(required = false) AdminFieldChangeActionDto request
    ) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        FieldChangeRequestDto dto = fcrService.unlockSection(
                fcrId,
                getCurrentUserId(),
                request != null ? request.getAdminNote() : null
        );
        return ResponseEntity.ok(ApiResponse.ok("Section unlocked for supplier", dto));
    }

    // ── Admin: reject the unlock request ──────────────────────────────────

    @PostMapping("/{fcrId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<FieldChangeRequestDto>> reject(
            @PathVariable UUID fcrId,
            @Valid @RequestBody(required = false) AdminFieldChangeActionDto request
    ) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        FieldChangeRequestDto dto = fcrService.rejectByAdmin(
                fcrId,
                getCurrentUserId(),
                request != null ? request.getAdminNote() : null
        );
        return ResponseEntity.ok(ApiResponse.ok("Change request rejected", dto));
    }

    // ── Supplier: submit the updated section into review ───────────────────

    @PostMapping("/{fcrId}/submit")
    public ResponseEntity<ApiResponse<FieldChangeRequestDto>> submit(@PathVariable UUID fcrId) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        FieldChangeRequestDto dto = fcrService.submitChange(fcrId, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.ok("Change submitted for review", dto));
    }

    @PostMapping("/{fcrId}/cancel")
    public ResponseEntity<ApiResponse<FieldChangeRequestDto>> cancel(@PathVariable UUID fcrId) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        FieldChangeRequestDto dto = fcrService.cancelUnlockedRequest(fcrId, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.ok("Change request cancelled", dto));
    }

    private User getCurrentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    private UUID getCurrentUserId() {
        User user = getCurrentUser();
        return user != null ? user.getId() : null;
    }
}
