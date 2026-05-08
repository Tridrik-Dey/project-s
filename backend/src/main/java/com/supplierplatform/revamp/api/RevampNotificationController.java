package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.UpsertNotificationTemplateRequest;
import com.supplierplatform.revamp.dto.NotificationTemplateDto;
import com.supplierplatform.revamp.dto.RevampNotificationEventSummaryDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.NotificationDeliveryStatus;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampNotificationEventService;
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
@RequestMapping("/api/v2/notifications")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class RevampNotificationController {

    private final RevampNotificationEventService notificationEventService;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @GetMapping("/templates")
    public ResponseEntity<ApiResponse<List<NotificationTemplateDto>>> templates() {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(notificationEventService.getTemplates()));
    }

    @PutMapping("/templates/{key}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<NotificationTemplateDto>> upsertTemplate(
            @PathVariable String key,
            @Valid @RequestBody UpsertNotificationTemplateRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN
        );
        NotificationTemplateDto dto = notificationEventService.upsertTemplate(key, request.getContent());
        return ResponseEntity.ok(ApiResponse.ok("Template updated", dto));
    }

    @GetMapping("/events")
    public ResponseEntity<ApiResponse<List<RevampNotificationEventSummaryDto>>> events(
            @RequestParam(value = "entityType", required = false) String entityType,
            @RequestParam(value = "entityId", required = false) UUID entityId,
            @RequestParam(value = "status", required = false) NotificationDeliveryStatus status
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(notificationEventService.listEvents(entityType, entityId, status)));
    }

    private UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) {
            return user.getId();
        }
        return null;
    }
}


