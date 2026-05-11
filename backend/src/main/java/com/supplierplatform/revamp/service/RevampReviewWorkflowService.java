package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampIntegrationRequestSummaryDto;
import com.supplierplatform.revamp.dto.RevampReviewCaseSummaryDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.IntegrationRequestStatus;
import com.supplierplatform.revamp.enums.ReviewCaseStatus;
import com.supplierplatform.revamp.enums.ReviewDecision;
import com.supplierplatform.revamp.enums.VerificationOutcome;
import com.supplierplatform.revamp.mapper.RevampReviewCaseMapper;
import com.supplierplatform.revamp.service.RevampFieldChangeRequestService;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampIntegrationRequestRepository;
import com.supplierplatform.revamp.repository.RevampReviewCaseRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class RevampReviewWorkflowService {

    private final RevampReviewCaseRepository reviewCaseRepository;
    private final RevampApplicationRepository applicationRepository;
    private final RevampIntegrationRequestRepository integrationRequestRepository;
    private final UserRepository userRepository;
    private final RevampReviewCaseMapper reviewCaseMapper;
    private final RevampAuditService auditService;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;
    private final RevampProfileProjectionService profileProjectionService;
    private final RevampIntegrationRequestMailService integrationRequestMailService;
    private final RevampFieldChangeRequestService fieldChangeRequestService;
    private final RevampDocumentRenewalRequestService documentRenewalRequestService;
    private final ObjectMapper objectMapper;
    private static final List<ReviewCaseStatus> FINAL_STATUSES = List.of(ReviewCaseStatus.DECIDED, ReviewCaseStatus.CLOSED);

    @Transactional(readOnly = true)
    public List<RevampReviewCaseSummaryDto> getQueue() {
        return reviewCaseRepository.findByStatusNotInOrderByUpdatedAtDesc(FINAL_STATUSES).stream()
                .collect(java.util.stream.Collectors.toMap(
                        caseItem -> caseItem.getApplication().getId(),
                        Function.identity(),
                        (first, second) -> compareByFreshness(second, first) > 0 ? second : first,
                        java.util.LinkedHashMap::new
                ))
                .values().stream()
                .sorted((a, b) -> compareByFreshness(b, a))
                .map(reviewCaseMapper::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RevampReviewCaseSummaryDto> getDecidedQueue() {
        return reviewCaseRepository.findByStatusInOrderByUpdatedAtDesc(FINAL_STATUSES).stream()
                .collect(java.util.stream.Collectors.toMap(
                        caseItem -> caseItem.getApplication().getId(),
                        Function.identity(),
                        (first, second) -> compareByFreshness(second, first) > 0 ? second : first,
                        java.util.LinkedHashMap::new
                ))
                .values().stream()
                .sorted((a, b) -> compareByFreshness(b, a))
                .map(reviewCaseMapper::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RevampReviewCaseSummaryDto> getHistory(UUID applicationId) {
        return reviewCaseRepository.findByApplicationIdOrderByCreatedAtDesc(applicationId).stream()
                .map(reviewCaseMapper::toSummary)
                .toList();
    }

    @Transactional
    public RevampReviewCaseSummaryDto openCase(UUID applicationId, UUID assignedToUserId, LocalDateTime slaDueAt) {
        RevampApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampApplication", applicationId));

        List<RevampReviewCase> activeCases = reviewCaseRepository
                .findByApplicationIdAndStatusNotInOrderByUpdatedAtDesc(applicationId, FINAL_STATUSES);
        RevampReviewCase reviewCase = activeCases.stream()
                .max(this::compareByFreshness)
                .orElseGet(() -> {
                    RevampReviewCase created = new RevampReviewCase();
                    created.setApplication(application);
                    created.setStatus(ReviewCaseStatus.IN_PROGRESS);
                    return created;
                });
        if (reviewCase.getStatus() == ReviewCaseStatus.PENDING_ASSIGNMENT) {
            reviewCase.setStatus(ReviewCaseStatus.IN_PROGRESS);
        }

        if (assignedToUserId != null) {
            boolean fieldChangeReview = reviewCase.getId() != null && fieldChangeRequestService.hasReviewCase(reviewCase.getId());
            String assignedRole = resolveActorGovernanceRole(assignedToUserId);
            if (fieldChangeReview && "REVISORE".equals(assignedRole)) {
                throw new IllegalStateException("Le modifiche dati possono essere prese in carico solo da SUPER_ADMIN o RESPONSABILE_ALBO.");
            }
            User assigned = userRepository.findById(assignedToUserId)
                    .orElseThrow(() -> new EntityNotFoundException("User", assignedToUserId));
            reviewCase.setAssignedToUser(assigned);
            reviewCase.setAssignedAt(LocalDateTime.now());
        } else if (reviewCase.getId() == null) {
            reviewCase.setAssignedAt(LocalDateTime.now());
        }
        if (slaDueAt != null) {
            reviewCase.setSlaDueAt(slaDueAt);
        }

        boolean documentRenewalReview = reviewCase.getId() != null && documentRenewalRequestService.hasReviewCase(reviewCase.getId());
        if (!documentRenewalReview) {
            application.setStatus(ApplicationStatus.UNDER_REVIEW);
        }
        applicationRepository.save(application);
        RevampReviewCase savedCase = reviewCaseRepository.save(reviewCase);
        fieldChangeRequestService.markUnderReview(savedCase.getId());
        documentRenewalRequestService.markUnderReview(savedCase.getId());
        String actorRole = resolveActorGovernanceRole(assignedToUserId);
        String actorName = reviewCase.getAssignedToUser() != null ? reviewCase.getAssignedToUser().getEmail() : "";
        auditService.append(new RevampAuditEventInputDto(
                "revamp.review.opened",
                "REVAMP_APPLICATION",
                application.getId(),
                assignedToUserId,
                actorRole,
                null,
                null,
                "{\"status\":\"DRAFT\"}",
                "{\"status\":\"UNDER_REVIEW\"}",
                "{\"reviewCaseId\":\"" + savedCase.getId()
                        + "\",\"actorName\":\"" + esc(actorName)
                        + "\",\"applicantName\":\"" + esc(application.getApplicantUser() != null ? application.getApplicantUser().getEmail() : "") + "\"}"
        ));

        return reviewCaseMapper.toSummary(savedCase);
    }

    @Transactional
    public RevampReviewCaseSummaryDto verifyCase(
            UUID reviewCaseId,
            UUID verifiedByUserId,
            String verificationNote,
            VerificationOutcome verificationOutcome
    ) {
        RevampReviewCase reviewCase = getReviewCase(reviewCaseId);
        if (reviewCase.getStatus() == ReviewCaseStatus.DECIDED || reviewCase.getStatus() == ReviewCaseStatus.CLOSED) {
            throw new IllegalStateException("Cannot verify a finalized review case.");
        }
        if (reviewCase.getStatus() == ReviewCaseStatus.WAITING_SUPPLIER_RESPONSE) {
            throw new IllegalStateException("Cannot verify while awaiting supplier response.");
        }
        boolean documentRenewalReview = documentRenewalRequestService.hasReviewCase(reviewCaseId);
        List<RevampReviewCase> targetReviewCases = documentRenewalReview
                ? activeDocumentRenewalReviewCases(reviewCase)
                : List.of(reviewCase);
        if (targetReviewCases.stream().allMatch(item -> item.getVerifiedAt() != null)) {
            throw new IllegalStateException("This review case has already been verified.");
        }
        if (verificationOutcome == null) {
            throw new IllegalArgumentException("Verification outcome is required.");
        }
        if ((verificationOutcome == VerificationOutcome.INCOMPLETE
                || verificationOutcome == VerificationOutcome.NON_COMPLIANT
                || verificationOutcome == VerificationOutcome.COMPLIANT_WITH_RESERVATIONS)
                && (verificationNote == null || verificationNote.isBlank())) {
            throw new IllegalArgumentException("Verification note is required for outcome: " + verificationOutcome.name());
        }

        if (reviewCase.getAssignedToUser() != null && verifiedByUserId != null
                && !reviewCase.getAssignedToUser().getId().equals(verifiedByUserId)) {
            String callerRole = resolveActorGovernanceRole(verifiedByUserId);
            if (!"SUPER_ADMIN".equals(callerRole)) {
                throw new IllegalStateException("Solo il revisore assegnato può verificare questa pratica.");
            }
        }

        if (verifiedByUserId != null) {
            User verifiedBy = userRepository.findById(verifiedByUserId)
                    .orElseThrow(() -> new EntityNotFoundException("User", verifiedByUserId));
            targetReviewCases.stream()
                    .filter(item -> item.getVerifiedAt() == null)
                    .forEach(item -> item.setVerifiedByUser(verifiedBy));
        }
        LocalDateTime verifiedAt = LocalDateTime.now();
        targetReviewCases.stream()
                .filter(item -> item.getVerifiedAt() == null)
                .forEach(item -> {
                    item.setVerifiedAt(verifiedAt);
                    item.setVerificationNote(verificationNote);
                    item.setVerificationOutcome(verificationOutcome);
                    item.setStatus(ReviewCaseStatus.READY_FOR_DECISION);
                });
        List<RevampReviewCase> savedCases = reviewCaseRepository.saveAll(targetReviewCases);
        if (documentRenewalReview) {
            documentRenewalRequestService.markUnderReviewForReviewCases(savedCases.stream().map(RevampReviewCase::getId).toList());
        }
        RevampReviewCase savedCase = savedCases.stream()
                .filter(item -> item.getId().equals(reviewCaseId))
                .findFirst()
                .orElse(reviewCase);
        String actorRole = resolveActorGovernanceRole(verifiedByUserId);
        String actorName = savedCase.getVerifiedByUser() != null ? savedCase.getVerifiedByUser().getEmail() : "";
        auditService.append(new RevampAuditEventInputDto(
                "revamp.review.verified",
                "REVAMP_APPLICATION",
                reviewCase.getApplication() != null ? reviewCase.getApplication().getId() : null,
                verifiedByUserId,
                actorRole,
                null,
                verificationNote,
                "{\"status\":\"" + ReviewCaseStatus.IN_PROGRESS.name() + "\"}",
                "{\"status\":\"" + ReviewCaseStatus.READY_FOR_DECISION.name() + "\"}",
                "{\"reviewCaseId\":\"" + savedCase.getId()
                        + "\",\"reviewType\":\"" + (documentRenewalReview ? "DOCUMENT_RENEWAL" : "APPLICATION")
                        + "\",\"reviewCaseIds\":" + toJsonArray(savedCases.stream().map(item -> item.getId().toString()).toList())
                        + ",\"actorName\":\"" + esc(actorName)
                        + "\",\"verificationOutcome\":\"" + verificationOutcome.name()
                        + "\",\"applicantName\":\"" + esc(reviewCase.getApplication() != null && reviewCase.getApplication().getApplicantUser() != null ? reviewCase.getApplication().getApplicantUser().getEmail() : "") + "\"}"
        ));
        return reviewCaseMapper.toSummary(savedCase);
    }

    @Transactional
    public RevampReviewCaseSummaryDto requestIntegration(
            UUID reviewCaseId,
            UUID requestedByUserId,
            LocalDateTime dueAt,
            String message,
            String requestedItemsJson
    ) {
        RevampReviewCase reviewCase = getReviewCase(reviewCaseId);
        if (reviewCase.getStatus() == ReviewCaseStatus.DECIDED || reviewCase.getStatus() == ReviewCaseStatus.CLOSED) {
            throw new IllegalStateException("Integration request not allowed for finalized review case.");
        }
        if (reviewCase.getVerifiedAt() == null) {
            throw new IllegalStateException("Cannot request integration before the review case has been verified.");
        }
        RevampIntegrationRequest openExisting = integrationRequestRepository
                .findFirstByReviewCaseIdAndStatusOrderByCreatedAtDesc(reviewCaseId, IntegrationRequestStatus.OPEN);
        if (openExisting != null) {
            throw new IllegalStateException("Open integration request already exists for this review case.");
        }

        RevampIntegrationRequest request = new RevampIntegrationRequest();
        request.setReviewCase(reviewCase);
        request.setDueAt(dueAt);
        request.setRequestMessage(message);
        request.setRequestedItemsJson(parseJsonRequired(requestedItemsJson, "requestedItemsJson"));
        request.setStatus(IntegrationRequestStatus.OPEN);

        if (requestedByUserId != null) {
            User requestedBy = userRepository.findById(requestedByUserId)
                    .orElseThrow(() -> new EntityNotFoundException("User", requestedByUserId));
            request.setRequestedByUser(requestedBy);
        }

        integrationRequestRepository.save(request);

        reviewCase.setStatus(ReviewCaseStatus.WAITING_SUPPLIER_RESPONSE);
        reviewCase.setSlaDueAt(dueAt);
        reviewCaseRepository.save(reviewCase);

        RevampApplication application = reviewCase.getApplication();
        ApplicationStatus beforeStatus = application.getStatus();
        application.setStatus(ApplicationStatus.INTEGRATION_REQUIRED);
        applicationRepository.save(application);
        String actorRole = resolveActorGovernanceRole(requestedByUserId);
        String actorName = request.getRequestedByUser() != null ? request.getRequestedByUser().getEmail() : "";
        auditService.append(new RevampAuditEventInputDto(
                "revamp.review.integration_requested",
                "REVAMP_APPLICATION",
                application.getId(),
                requestedByUserId,
                actorRole,
                null,
                null,
                "{\"status\":\"" + beforeStatus.name() + "\"}",
                "{\"status\":\"" + application.getStatus().name() + "\"}",
                "{\"reviewCaseId\":\"" + reviewCase.getId()
                        + "\",\"actorName\":\"" + esc(actorName)
                        + "\",\"applicantName\":\"" + esc(application.getApplicantUser() != null ? application.getApplicantUser().getEmail() : "") + "\"}"
        ));

        integrationRequestMailService.sendIntegrationRequestNotice(application, request);

        return reviewCaseMapper.toSummary(reviewCase);
    }

    @Transactional(readOnly = true)
    public RevampIntegrationRequestSummaryDto getLatestIntegrationRequest(UUID reviewCaseId) {
        RevampIntegrationRequest latest = integrationRequestRepository
                .findFirstByReviewCaseIdOrderByCreatedAtDesc(reviewCaseId);
        if (latest == null) {
            return null;
        }
        return new RevampIntegrationRequestSummaryDto(
                latest.getId(),
                latest.getReviewCase() != null ? latest.getReviewCase().getId() : null,
                latest.getStatus() != null ? latest.getStatus().name() : null,
                latest.getDueAt(),
                latest.getRequestMessage(),
                latest.getRequestedItemsJson(),
                latest.getSupplierResponseJson(),
                latest.getUpdatedAt()
        );
    }

    @Transactional
    public RevampReviewCaseSummaryDto decide(UUID reviewCaseId, ReviewDecision decision, String reason, UUID decidedByUserId) {
        RevampReviewCase reviewCase = getReviewCase(reviewCaseId);
        if (reviewCase.getStatus() == ReviewCaseStatus.DECIDED || reviewCase.getStatus() == ReviewCaseStatus.CLOSED) {
            throw new IllegalStateException("Review case is already finalized.");
        }
        if (reviewCase.getStatus() == ReviewCaseStatus.WAITING_SUPPLIER_RESPONSE) {
            throw new IllegalStateException("Cannot decide while awaiting supplier response.");
        }
        boolean fieldChangeReview = fieldChangeRequestService.hasReviewCase(reviewCaseId);
        boolean documentRenewalReview = documentRenewalRequestService.hasReviewCase(reviewCaseId);
        List<RevampReviewCase> targetReviewCases = documentRenewalReview
                ? activeDocumentRenewalReviewCases(reviewCase)
                : List.of(reviewCase);
        if (!fieldChangeReview && targetReviewCases.stream().anyMatch(item -> item.getVerifiedAt() == null)) {
            throw new IllegalStateException("Cannot decide before the review case has been verified.");
        }
        RevampIntegrationRequest openExisting = integrationRequestRepository
                .findFirstByReviewCaseIdAndStatusOrderByCreatedAtDesc(reviewCaseId, IntegrationRequestStatus.OPEN);
        if (openExisting != null) {
            throw new IllegalStateException("Cannot decide while an integration request is open.");
        }
        if (decision == ReviewDecision.INTEGRATION_REQUIRED) {
            throw new IllegalArgumentException("Use the request-integration endpoint to request additional documentation.");
        }
        RevampApplication application = reviewCase.getApplication();
        ApplicationStatus beforeStatus = application.getStatus();

        User decidedBy = null;
        if (decidedByUserId != null) {
            decidedBy = userRepository.findById(decidedByUserId)
                    .orElseThrow(() -> new EntityNotFoundException("User", decidedByUserId));
        }

        LocalDateTime decidedAt = LocalDateTime.now();
        for (RevampReviewCase targetCase : targetReviewCases) {
            targetCase.setDecision(decision);
            targetCase.setDecisionReason(reason);
            targetCase.setDecidedByUser(decidedBy);
            targetCase.setDecidedAt(decidedAt);
            targetCase.setStatus(ReviewCaseStatus.DECIDED);
        }

        if (documentRenewalReview) {
            application.setStatus(ApplicationStatus.APPROVED);
        } else {
            switch (decision) {
                case APPROVED -> {
                    application.setStatus(ApplicationStatus.APPROVED);
                    application.setApprovedAt(LocalDateTime.now());
                }
                case REJECTED -> {
                    application.setStatus(ApplicationStatus.REJECTED);
                    application.setRejectedAt(LocalDateTime.now());
                }
                default -> throw new IllegalStateException("Unhandled review decision: " + decision);
            }
        }

        applicationRepository.save(application);
        List<RevampReviewCase> savedCases = reviewCaseRepository.saveAll(targetReviewCases);
        RevampReviewCase savedCase = savedCases.stream()
                .filter(item -> item.getId().equals(reviewCaseId))
                .findFirst()
                .orElse(reviewCase);
        fieldChangeRequestService.handleReviewDecision(savedCase.getId(), decision, decidedByUserId, reason);
        if (documentRenewalReview) {
            documentRenewalRequestService.handleReviewDecisionForReviewCases(
                    savedCases.stream().map(RevampReviewCase::getId).toList(),
                    decision,
                    decidedByUserId,
                    reason
            );
        } else {
            documentRenewalRequestService.handleReviewDecision(savedCase.getId(), decision, decidedByUserId, reason);
        }
        if (decision == ReviewDecision.APPROVED) {
            profileProjectionService.projectApprovedApplication(application.getId());
        }
        String actorRole = resolveActorGovernanceRole(decidedByUserId);
        List<String> renewalDocumentLabels = documentRenewalReview
                ? savedCases.stream()
                        .flatMap(item -> documentRenewalRequestService.labelsForReviewCase(item.getId()).stream())
                        .distinct()
                        .toList()
                : List.of();
        auditService.append(new RevampAuditEventInputDto(
                "revamp.review.decided",
                "REVAMP_APPLICATION",
                application.getId(),
                decidedByUserId,
                actorRole,
                null,
                reason,
                "{\"status\":\"" + beforeStatus.name() + "\"}",
                "{\"status\":\"" + application.getStatus().name() + "\"}",
                "{\"decision\":\"" + decision.name()
                        + "\",\"reviewCaseId\":\"" + savedCase.getId()
                        + "\",\"reviewType\":\"" + (documentRenewalReview ? "DOCUMENT_RENEWAL" : fieldChangeReview ? "FIELD_CHANGE" : "APPLICATION")
                        + "\",\"documents\":" + toJsonArray(renewalDocumentLabels)
                        + ",\"actorName\":\"" + esc(decidedBy != null ? decidedBy.getEmail() : "")
                        + "\",\"applicantName\":\"" + esc(application.getApplicantUser() != null ? application.getApplicantUser().getEmail() : "") + "\"}"
        ));
        return reviewCaseMapper.toSummary(savedCase);
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private List<RevampReviewCase> activeDocumentRenewalReviewCases(RevampReviewCase reviewCase) {
        if (reviewCase == null || reviewCase.getApplication() == null) return List.of();
        List<UUID> ids = documentRenewalRequestService.activeReviewCaseIdsForApplication(
                reviewCase.getApplication().getId(),
                reviewCase.getId()
        );
        return java.util.stream.StreamSupport.stream(reviewCaseRepository.findAllById(ids).spliterator(), false)
                .filter(item -> item.getStatus() != ReviewCaseStatus.DECIDED && item.getStatus() != ReviewCaseStatus.CLOSED)
                .sorted(Comparator.comparing(RevampReviewCase::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private static String toJsonArray(List<String> items) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < items.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(esc(items.get(i))).append("\"");
        }
        sb.append("]");
        return sb.toString();
    }

    private String resolveActorGovernanceRole(UUID actorUserId) {
        if (actorUserId == null) return null;
        try {
            return governanceAuthorizationService.resolveAdminGovernanceRole(actorUserId).name();
        } catch (RuntimeException ex) {
            return "ADMIN";
        }
    }

    private RevampReviewCase getReviewCase(UUID reviewCaseId) {
        return reviewCaseRepository.findById(reviewCaseId)
                .orElseThrow(() -> new EntityNotFoundException("RevampReviewCase", reviewCaseId));
    }

    private JsonNode parseJsonRequired(String raw, String fieldName) {
        String normalized = (raw == null || raw.isBlank()) ? "[]" : raw;
        try {
            return objectMapper.readTree(normalized);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Invalid JSON for " + fieldName, ex);
        }
    }

    private int compareByFreshness(RevampReviewCase left, RevampReviewCase right) {
        Comparator<LocalDateTime> comparator = Comparator.nullsFirst(LocalDateTime::compareTo);
        int updatedCompare = comparator.compare(left.getUpdatedAt(), right.getUpdatedAt());
        if (updatedCompare != 0) {
            return updatedCompare;
        }
        return comparator.compare(left.getCreatedAt(), right.getCreatedAt());
    }
}
