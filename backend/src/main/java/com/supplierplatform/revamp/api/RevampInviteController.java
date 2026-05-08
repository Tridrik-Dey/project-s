package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.CreateInviteRequest;
import com.supplierplatform.revamp.api.dto.RenewInviteRequest;
import com.supplierplatform.revamp.api.dto.UpdateInviteRequest;
import com.supplierplatform.revamp.dto.RevampInviteMonitorDto;
import com.supplierplatform.revamp.dto.RevampInviteReminderRunDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampInviteExpiryReminderService;
import com.supplierplatform.revamp.service.RevampInviteService;
import com.supplierplatform.revamp.service.RevampSupplierInviteMailService;
import com.supplierplatform.user.User;
import com.supplierplatform.validation.EmailDeliverabilityValidator;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/invites")
@RequiredArgsConstructor
public class RevampInviteController {

    private final RevampInviteService inviteService;
    private final RevampInviteExpiryReminderService inviteExpiryReminderService;
    private final RevampSupplierInviteMailService supplierInviteMailService;
    private final EmailDeliverabilityValidator emailDeliverabilityValidator;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createInvite(@Valid @RequestBody CreateInviteRequest request) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        governanceAuthorizationService.requireAnyRole(
                currentUser == null ? null : currentUser.getId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        int expiresInDays = request.getExpiresInDays() != null ? Math.max(1, request.getExpiresInDays()) : 30;
        String invitedEmail = request.getInvitedEmail() == null ? "" : request.getInvitedEmail().trim().toLowerCase();
        if (!emailDeliverabilityValidator.hasReceivableDomain(invitedEmail)) {
            throw new IllegalArgumentException("Email domain cannot receive mail");
        }

        RevampInvite invite = inviteService.createInvite(
                request.getRegistryType(),
                invitedEmail,
                request.getInvitedName(),
                currentUser != null ? currentUser.getId() : null,
                LocalDateTime.now().plusDays(expiresInDays),
                request.getNote()
        );
        RevampSupplierInviteMailService.InviteDispatchResult dispatch = supplierInviteMailService.sendInvite(invite);
        if (dispatch.sent()) {
            invite = inviteService.markSent(invite.getId(), currentUser != null ? currentUser.getId() : null);
        }

        Map<String, Object> payload = invitePayload(invite, dispatch);
        return ResponseEntity.ok(ApiResponse.ok(dispatch.sent() ? "Invite created and email sent" : "Invite created but email failed", payload));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RevampInviteMonitorDto>> monitorInvites() {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(inviteService.monitorInvites()));
    }

    @PostMapping("/{inviteId}/renew")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> renewInvite(
            @PathVariable UUID inviteId,
            @Valid @RequestBody(required = false) RenewInviteRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        governanceAuthorizationService.requireAnyRole(
                currentUser == null ? null : currentUser.getId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        int expiresInDays = request != null && request.getExpiresInDays() != null
                ? Math.max(1, request.getExpiresInDays())
                : 30;
        RevampInvite invite = inviteService.renewInvite(
                inviteId,
                currentUser != null ? currentUser.getId() : null,
                expiresInDays
        );
        RevampSupplierInviteMailService.InviteDispatchResult dispatch = supplierInviteMailService.sendInvite(invite);
        if (dispatch.sent()) {
            invite = inviteService.markSent(invite.getId(), currentUser != null ? currentUser.getId() : null);
        }
        Map<String, Object> payload = invitePayload(invite, dispatch);
        return ResponseEntity.ok(ApiResponse.ok(dispatch.sent() ? "Invite renewed and email sent" : "Invite renewed but email failed", payload));
    }

    @PostMapping("/{inviteId}/resend")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resendInvite(@PathVariable UUID inviteId) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        governanceAuthorizationService.requireAnyRole(
                currentUser == null ? null : currentUser.getId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        RevampInvite invite = inviteService.markSent(inviteId, currentUser != null ? currentUser.getId() : null);
        RevampSupplierInviteMailService.InviteDispatchResult dispatch = supplierInviteMailService.sendInvite(invite);
        return ResponseEntity.ok(ApiResponse.ok(dispatch.sent() ? "Invite resent and email sent" : "Invite resend failed", invitePayload(invite, dispatch)));
    }

    @PutMapping("/{inviteId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateInvite(
            @PathVariable UUID inviteId,
            @Valid @RequestBody UpdateInviteRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        User currentUser = getCurrentUser();
        governanceAuthorizationService.requireAnyRole(
                currentUser == null ? null : currentUser.getId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        String invitedEmail = request.getInvitedEmail() == null ? "" : request.getInvitedEmail().trim().toLowerCase();
        if (!emailDeliverabilityValidator.hasReceivableDomain(invitedEmail)) {
            throw new IllegalArgumentException("Email domain cannot receive mail");
        }
        int expiresInDays = request.getExpiresInDays() != null ? Math.max(1, request.getExpiresInDays()) : 30;
        RevampInvite invite = inviteService.updateInvite(
                inviteId,
                request.getRegistryType(),
                invitedEmail,
                request.getInvitedName(),
                currentUser != null ? currentUser.getId() : null,
                LocalDateTime.now().plusDays(expiresInDays),
                request.getNote()
        );
        Map<String, Object> payload = Map.of(
                "id", invite.getId(),
                "token", invite.getToken(),
                "status", invite.getStatus().name(),
                "registryType", invite.getRegistryType().name(),
                "invitedEmail", invite.getInvitedEmail(),
                "invitedName", invite.getInvitedName() == null ? "" : invite.getInvitedName(),
                "expiresAt", invite.getExpiresAt(),
                "mailSent", false,
                "inviteUrl", supplierInviteMailService.buildInviteUrl(invite.getToken()),
                "mailFailureReason", ""
        );
        return ResponseEntity.ok(ApiResponse.ok("Invite updated", payload));
    }

    @PostMapping("/reminders/run")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<RevampInviteReminderRunDto>> runInviteExpiryReminders() {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        RevampInviteReminderRunDto result = inviteExpiryReminderService.runNow(LocalDate.now());
        return ResponseEntity.ok(ApiResponse.ok("Invite expiry reminder run completed", result));
    }

    @GetMapping("/token/{token}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getByToken(@PathVariable String token) {
        revampAccessGuard.requireReadEnabled();
        RevampInvite invite = inviteService.getByToken(token);
        Map<String, Object> payload = Map.of(
                "id", invite.getId(),
                "status", invite.getStatus().name(),
                "registryType", invite.getRegistryType().name(),
                "invitedName", invite.getInvitedName() == null ? "" : invite.getInvitedName(),
                "invitedEmail", invite.getInvitedEmail(),
                "expiresAt", invite.getExpiresAt()
        );
        return ResponseEntity.ok(ApiResponse.ok(payload));
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

    private Map<String, Object> invitePayload(
            RevampInvite invite,
            RevampSupplierInviteMailService.InviteDispatchResult dispatch
    ) {
        return Map.of(
                "id", invite.getId(),
                "token", invite.getToken(),
                "status", invite.getStatus().name(),
                "registryType", invite.getRegistryType().name(),
                "invitedEmail", invite.getInvitedEmail(),
                "invitedName", invite.getInvitedName() == null ? "" : invite.getInvitedName(),
                "expiresAt", invite.getExpiresAt(),
                "mailSent", dispatch.sent(),
                "inviteUrl", dispatch.inviteUrl(),
                "mailFailureReason", dispatch.failureReason() == null ? "" : dispatch.failureReason()
        );
    }
}


