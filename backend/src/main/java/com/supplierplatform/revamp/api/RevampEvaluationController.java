package com.supplierplatform.revamp.api;

import com.supplierplatform.common.ApiResponse;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.SubmitEvaluationRequest;
import com.supplierplatform.revamp.dto.RevampEvaluationAggregateDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAnalyticsDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAssignmentDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAssignmentRowDto;
import com.supplierplatform.revamp.dto.RevampEvaluationOverviewDto;
import com.supplierplatform.revamp.dto.RevampEvaluationSummaryDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampEvaluationAssignmentService;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampEvaluationService;
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
@RequestMapping("/api/v2/evaluations")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class RevampEvaluationController {

    private final RevampEvaluationService evaluationService;
    private final RevampEvaluationAssignmentService evaluationAssignmentService;
    private final RevampAccessGuard revampAccessGuard;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    /** VIEWER: self-assign a supplier to evaluate */
    @PostMapping("/assignments/{supplierId}")
    public ResponseEntity<ApiResponse<RevampEvaluationAssignmentDto>> selfAssign(@PathVariable UUID supplierId) {
        revampAccessGuard.requireWriteEnabled();
        RevampEvaluationAssignmentDto dto = evaluationAssignmentService.selfAssign(supplierId, getCurrentUserId());
        return ResponseEntity.ok(ApiResponse.ok("Supplier taken for evaluation", dto));
    }

    /** All roles: list assignments. VIEWER sees all suppliers + their own status. Others see all (viewer, supplier) pairs. */
    @GetMapping("/assignments")
    public ResponseEntity<ApiResponse<List<RevampEvaluationAssignmentRowDto>>> assignments() {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN, AdminRole.RESPONSABILE_ALBO, AdminRole.REVISORE, AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(evaluationAssignmentService.listAssignments(getCurrentUserId())));
    }

    /** VIEWER: submit (upsert) evaluation for an assigned supplier */
    @PostMapping("/{supplierId}/submit")
    public ResponseEntity<ApiResponse<RevampEvaluationSummaryDto>> submit(
            @PathVariable UUID supplierId,
            @Valid @RequestBody SubmitEvaluationRequest request
    ) {
        revampAccessGuard.requireWriteEnabled();
        RevampEvaluationSummaryDto dto = evaluationService.upsertEvaluation(
                supplierId,
                getCurrentUserId(),
                request.getCollaborationType(),
                request.getCollaborationPeriod(),
                request.getReferenceCode(),
                request.getOverallScore(),
                request.getComment(),
                request.getDimensions()
        );
        return ResponseEntity.ok(ApiResponse.ok("Evaluation submitted", dto));
    }

    /** SUPER_ADMIN: delete a viewer's evaluation */
    @DeleteMapping("/{evaluationId}")
    public ResponseEntity<ApiResponse<Void>> deleteEvaluation(@PathVariable UUID evaluationId) {
        revampAccessGuard.requireWriteEnabled();
        governanceAuthorizationService.requireAnyRole(getCurrentUserId(), AdminRole.SUPER_ADMIN);
        evaluationService.deleteEvaluation(evaluationId, getCurrentUserId());
        return ResponseEntity.ok(ApiResponse.ok("Evaluation deleted", null));
    }

    /** All roles: list evaluations for a supplier */
    @GetMapping
    public ResponseEntity<ApiResponse<List<RevampEvaluationSummaryDto>>> listBySupplier(
            @RequestParam("supplierId") UUID supplierId
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN, AdminRole.RESPONSABILE_ALBO, AdminRole.REVISORE, AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(evaluationService.listBySupplier(supplierId)));
    }

    /** All roles: overview of all evaluations */
    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<RevampEvaluationOverviewDto>> overview(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "period", required = false) String period,
            @RequestParam(name = "minScore", required = false) Double minScore,
            @RequestParam(name = "evaluator", required = false) String evaluator,
            @RequestParam(name = "limit", defaultValue = "200") Integer limit
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN, AdminRole.RESPONSABILE_ALBO, AdminRole.REVISORE, AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(evaluationService.overview(q, type, period, minScore, evaluator, limit)));
    }

    /** All roles: summary aggregate for a supplier */
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<RevampEvaluationAggregateDto>> summaryBySupplier(
            @RequestParam("supplierId") UUID supplierId
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN, AdminRole.RESPONSABILE_ALBO, AdminRole.REVISORE, AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(evaluationService.summaryBySupplier(supplierId)));
    }

    /** All roles: detailed analytics for a supplier */
    @GetMapping("/{supplierId}/analytics")
    public ResponseEntity<ApiResponse<RevampEvaluationAnalyticsDto>> analyticsBySupplier(
            @PathVariable UUID supplierId
    ) {
        revampAccessGuard.requireReadEnabled();
        governanceAuthorizationService.requireAnyRole(
                getCurrentUserId(),
                AdminRole.SUPER_ADMIN, AdminRole.RESPONSABILE_ALBO, AdminRole.REVISORE, AdminRole.VIEWER
        );
        return ResponseEntity.ok(ApiResponse.ok(evaluationService.analyticsBySupplier(supplierId)));
    }

    private User getCurrentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) return user;
        return null;
    }

    private UUID getCurrentUserId() {
        User user = getCurrentUser();
        return user != null ? user.getId() : null;
    }
}
