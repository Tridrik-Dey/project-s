package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.CreateAdminUserInviteRequest;
import com.supplierplatform.revamp.dto.AdminUserInviteDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampAdminUserProvisioningService;
import com.supplierplatform.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v2/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class RevampAdminUserController {

    private final RevampAccessGuard revampAccessGuard;
    private final RevampAdminUserProvisioningService provisioningService;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @PostMapping("/invite")
    public ResponseEntity<ApiResponse<AdminUserInviteDto>> inviteAdminUser(
            @Valid @RequestBody CreateAdminUserInviteRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(getCurrentUserId(), AdminRole.SUPER_ADMIN);
        User currentUser = getCurrentUser();
        UUID actorId = currentUser == null ? null : currentUser.getId();
        AdminUserInviteDto dto = provisioningService.inviteAdminUser(
                request.getEmail(),
                request.getAdminRole(),
                request.getExpiresInDays() == null ? 7 : request.getExpiresInDays(),
                actorId
        );
        return ResponseEntity.ok(ApiResponse.ok("Admin invite created", dto));
    }

    @PostMapping("/{userId}/invite/resend")
    public ResponseEntity<ApiResponse<AdminUserInviteDto>> resendAdminUserInvite(@PathVariable UUID userId) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(getCurrentUserId(), AdminRole.SUPER_ADMIN);
        User currentUser = getCurrentUser();
        UUID actorId = currentUser == null ? null : currentUser.getId();
        AdminUserInviteDto dto = provisioningService.resendAdminUserInvite(userId, 7, actorId);
        return ResponseEntity.ok(ApiResponse.ok("Admin invite resent", dto));
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
}
