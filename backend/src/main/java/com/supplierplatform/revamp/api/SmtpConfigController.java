package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.config.SmtpConfigStore;
import com.supplierplatform.revamp.dto.SmtpConfigRequest;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/admin/smtp-config")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class SmtpConfigController {

    private final SmtpConfigStore smtpConfigStore;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> getConfig() {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(getCurrentUserId(), AdminRole.SUPER_ADMIN);
        String email = smtpConfigStore.getEmail();
        return ResponseEntity.ok(ApiResponse.ok(Map.of(
                "email", email != null ? email : "",
                "passwordConfigured", smtpConfigStore.hasConfig(),
                "debugOtpEnabled", smtpConfigStore.isDebugOtpEnabled()
        )));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Void>> saveConfig(@Valid @RequestBody SmtpConfigRequest request) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(getCurrentUserId(), AdminRole.SUPER_ADMIN);
        try {
            String password = request.password();
            String effectivePassword = password != null && !password.isBlank()
                    ? password
                    : smtpConfigStore.getPassword();
            if (effectivePassword == null || effectivePassword.isBlank()) {
                throw new IllegalArgumentException("SMTP app password is required.");
            }
            smtpConfigStore.save(request.email(), effectivePassword, Boolean.TRUE.equals(request.debugOtpEnabled()));
        } catch (IOException e) {
            throw new IllegalStateException("Failed to save SMTP config: " + e.getMessage(), e);
        }
        return ResponseEntity.ok(ApiResponse.ok("SMTP config saved", null));
    }

    private UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) return user.getId();
        return null;
    }
}
