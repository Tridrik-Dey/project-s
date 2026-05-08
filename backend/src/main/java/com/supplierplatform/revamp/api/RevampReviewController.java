package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.AssignReviewCaseRequest;
import com.supplierplatform.revamp.api.dto.ReviewDecisionRequest;
import com.supplierplatform.revamp.api.dto.ReviewIntegrationRequest;
import com.supplierplatform.revamp.api.dto.VerifyReviewCaseRequest;
import com.supplierplatform.revamp.dto.RevampIntegrationRequestSummaryDto;
import com.supplierplatform.revamp.dto.RevampReviewCaseSummaryDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.VerificationOutcome;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampReviewWorkflowService;
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
@RequestMapping("/api/v2/reviews")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class RevampReviewController {

    private final RevampReviewWorkflowService reviewWorkflowService;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @GetMapping("/queue")
    public ResponseEntity<ApiResponse<List<RevampReviewCaseSummaryDto>>> queue() {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE
        );
        return ResponseEntity.ok(ApiResponse.ok(reviewWorkflowService.getQueue()));
    }

    @GetMapping("/decided")
    public ResponseEntity<ApiResponse<List<RevampReviewCaseSummaryDto>>> decided() {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE
        );
        return ResponseEntity.ok(ApiResponse.ok(reviewWorkflowService.getDecidedQueue()));
    }

    @PostMapping("/{applicationId}/assign")
    public ResponseEntity<ApiResponse<RevampReviewCaseSummaryDto>> assign(
            @PathVariable UUID applicationId,
            @Valid @RequestBody(required = false) AssignReviewCaseRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE
        );
        UUID assignedToUserId = request != null ? request.getAssignedToUserId() : null;
        if (assignedToUserId == null) {
            User currentUser = getCurrentUser();
            assignedToUserId = currentUser != null ? currentUser.getId() : null;
        }
        RevampReviewCaseSummaryDto dto = reviewWorkflowService.openCase(
                applicationId,
                assignedToUserId,
                request != null ? request.getSlaDueAt() : null
        );
        return ResponseEntity.ok(ApiResponse.ok("Review case assigned", dto));
    }

    @PostMapping("/{reviewCaseId}/verify")
    public ResponseEntity<ApiResponse<RevampReviewCaseSummaryDto>> verify(
            @PathVariable UUID reviewCaseId,
            @Valid @RequestBody(required = false) VerifyReviewCaseRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE
        );
        User currentUser = getCurrentUser();
        RevampReviewCaseSummaryDto dto = reviewWorkflowService.verifyCase(
                reviewCaseId,
                currentUser != null ? currentUser.getId() : null,
                request != null ? request.getVerificationNote() : null,
                request != null ? request.getVerificationOutcome() : VerificationOutcome.COMPLIANT
        );
        return ResponseEntity.ok(ApiResponse.ok("Review case verified", dto));
    }

    @PostMapping("/{reviewCaseId}/integration-request")
    public ResponseEntity<ApiResponse<RevampReviewCaseSummaryDto>> integrationRequest(
            @PathVariable UUID reviewCaseId,
            @Valid @RequestBody ReviewIntegrationRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        User currentUser = getCurrentUser();
        RevampReviewCaseSummaryDto dto = reviewWorkflowService.requestIntegration(
                reviewCaseId,
                currentUser != null ? currentUser.getId() : null,
                request.getDueAt(),
                request.getMessage(),
                request.getRequestedItemsJson()
        );
        return ResponseEntity.ok(ApiResponse.ok("Integration requested", dto));
    }

    @PostMapping("/{reviewCaseId}/decision")
    public ResponseEntity<ApiResponse<RevampReviewCaseSummaryDto>> decision(
            @PathVariable UUID reviewCaseId,
            @Valid @RequestBody ReviewDecisionRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO
        );
        User currentUser = getCurrentUser();
        RevampReviewCaseSummaryDto dto = reviewWorkflowService.decide(
                reviewCaseId,
                request.getDecision(),
                request.getReason(),
                currentUser != null ? currentUser.getId() : null
        );
        return ResponseEntity.ok(ApiResponse.ok("Review decision saved", dto));
    }

    @GetMapping("/{applicationId}/history")
    public ResponseEntity<ApiResponse<List<RevampReviewCaseSummaryDto>>> history(@PathVariable UUID applicationId) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE
        );
        return ResponseEntity.ok(ApiResponse.ok(reviewWorkflowService.getHistory(applicationId)));
    }

    @GetMapping("/{reviewCaseId}/integration-latest")
    public ResponseEntity<ApiResponse<RevampIntegrationRequestSummaryDto>> latestIntegration(@PathVariable UUID reviewCaseId) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE
        );
        return ResponseEntity.ok(ApiResponse.ok(reviewWorkflowService.getLatestIntegrationRequest(reviewCaseId)));
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


