package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.dto.ComposeEmailRequest;
import com.supplierplatform.revamp.dto.RevampSupplierProfileDto;
import com.supplierplatform.revamp.dto.RevampSupplierProfileTimelineEventDto;
import com.supplierplatform.revamp.enums.RegistryProfileStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampSupplierProfileService;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/profiles")
@RequiredArgsConstructor
public class RevampProfileController {

    private final RevampSupplierProfileService supplierProfileService;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<RevampSupplierProfileDto>>> listProfiles(
            @RequestParam(name = "registryType", required = false) RegistryType registryType,
            @RequestParam(name = "status", required = false) RegistryProfileStatus status,
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "ateco", required = false) String ateco,
            @RequestParam(name = "region", required = false) String region,
            @RequestParam(name = "serviceCategory", required = false) String serviceCategory,
            @RequestParam(name = "certification", required = false) String certification,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size
    ) {
        revampAccessGuard.requireReadEnabled();
        AdminRole adminRole = governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.min(Math.max(size, 1), 100),
                Sort.by("updatedAt").descending()
        );
        Page<RevampSupplierProfileDto> result = supplierProfileService.listAdminProfiles(
                registryType,
                status,
                q,
                ateco,
                region,
                serviceCategory,
                certification,
                pageable,
                adminRole
        );
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    @GetMapping("/{profileId}")
    @PreAuthorize("hasAnyRole('SUPPLIER','ADMIN')")
    public ResponseEntity<ApiResponse<RevampSupplierProfileDto>> getProfile(@PathVariable UUID profileId) {
        revampAccessGuard.requireReadEnabled();
        AdminRole adminRole = requireGovernanceReadForAdmin();
        RevampSupplierProfileDto dto = supplierProfileService.getProfile(profileId, getCurrentUser());
        enforceViewerActiveOnly(adminRole, dto);
        return ResponseEntity.ok(ApiResponse.ok(dto));
    }

    @GetMapping("/{profileId}/timeline")
    @PreAuthorize("hasAnyRole('SUPPLIER','ADMIN')")
    public ResponseEntity<ApiResponse<List<RevampSupplierProfileTimelineEventDto>>> timeline(@PathVariable UUID profileId) {
        revampAccessGuard.requireReadEnabled();
        AdminRole adminRole = requireGovernanceReadForAdmin();
        if (adminRole == AdminRole.VIEWER) {
            RevampSupplierProfileDto dto = supplierProfileService.getProfile(profileId, getCurrentUser());
            enforceViewerActiveOnly(adminRole, dto);
        }
        return ResponseEntity.ok(ApiResponse.ok(supplierProfileService.getTimeline(profileId, getCurrentUser())));
    }

    @PostMapping("/{profileId}/renewal/start")
    @PreAuthorize("hasAnyRole('SUPPLIER','ADMIN')")
    public ResponseEntity<ApiResponse<RevampSupplierProfileDto>> startRenewal(@PathVariable UUID profileId) {
        revampAccessGuard.requireWriteEnabled();
        requireGovernanceWriteForAdmin();
        RevampSupplierProfileDto dto = supplierProfileService.startRenewal(profileId, getCurrentUser());
        return ResponseEntity.ok(ApiResponse.ok("Renewal started", dto));
    }

    @PostMapping("/{profileId}/suspend")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RevampSupplierProfileDto>> suspend(@PathVariable UUID profileId) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        RevampSupplierProfileDto dto = supplierProfileService.suspend(profileId, getCurrentUser());
        return ResponseEntity.ok(ApiResponse.ok("Profile suspended", dto));
    }

    @PostMapping("/{profileId}/compose-email")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> composeEmail(
            @PathVariable UUID profileId,
            @Valid @RequestBody ComposeEmailRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE
        );
        supplierProfileService.composeEmail(profileId, request, getCurrentUser());
        return ResponseEntity.ok(ApiResponse.ok("Email inviata con successo", null));
    }

    @PostMapping("/{profileId}/reactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RevampSupplierProfileDto>> reactivate(@PathVariable UUID profileId) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        RevampSupplierProfileDto dto = supplierProfileService.reactivate(profileId, getCurrentUser());
        return ResponseEntity.ok(ApiResponse.ok("Profile reactivated", dto));
    }

    private User getCurrentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) {
            return user;
        }
        return null;
    }

    private UUID getCurrentUserId() {
        User user = getCurrentUser();
        return user != null ? user.getId() : null;
    }

    private AdminRole requireGovernanceReadForAdmin() {
        User currentUser = getCurrentUser();
        if (currentUser != null && currentUser.getRole() == UserRole.ADMIN) {
            return governanceAuthorizationService.requireAnyRole(
                    currentUser.getId(),
                    AdminRole.SUPER_ADMIN,
                    AdminRole.RESPONSABILE_ALBO,
                    AdminRole.REVISORE,
                    AdminRole.VIEWER
            );
        }
        return null;
    }

    private void requireGovernanceWriteForAdmin() {
        User currentUser = getCurrentUser();
        if (currentUser != null && currentUser.getRole() == UserRole.ADMIN) {
            governanceAuthorizationService.requireAnyRole(
                    currentUser.getId(),
                    AdminRole.SUPER_ADMIN,
                    AdminRole.RESPONSABILE_ALBO
            );
        }
    }

    private void enforceViewerActiveOnly(AdminRole adminRole, RevampSupplierProfileDto dto) {
        if (adminRole != AdminRole.VIEWER) {
            return;
        }
        boolean isActive = dto.status() == RegistryProfileStatus.APPROVED && dto.visible();
        if (!isActive) {
            throw new AccessDeniedException("Viewer can access only active supplier profiles");
        }
    }
}



