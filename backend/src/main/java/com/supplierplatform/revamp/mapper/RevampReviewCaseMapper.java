package com.supplierplatform.revamp.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import com.supplierplatform.revamp.dto.DocumentRenewalRequestDto;
import com.supplierplatform.revamp.dto.RevampReviewCaseSummaryDto;
import com.supplierplatform.revamp.enums.DocumentRenewalRequestStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampDocumentRenewalRequest;
import com.supplierplatform.revamp.model.RevampFieldChangeRequest;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampDocumentRenewalRequestRepository;
import com.supplierplatform.revamp.repository.RevampFieldChangeRequestRepository;
import com.supplierplatform.revamp.repository.RevampIntegrationRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class RevampReviewCaseMapper {

    private RevampIntegrationRequestRepository integrationRequestRepository;
    private RevampApplicationSectionRepository sectionRepository;
    private RevampFieldChangeRequestRepository fieldChangeRequestRepository;
    private RevampDocumentRenewalRequestRepository documentRenewalRequestRepository;

    public RevampReviewCaseMapper() {
    }

    @Autowired
    public RevampReviewCaseMapper(RevampIntegrationRequestRepository integrationRequestRepository,
                                  RevampApplicationSectionRepository sectionRepository,
                                  RevampFieldChangeRequestRepository fieldChangeRequestRepository,
                                  RevampDocumentRenewalRequestRepository documentRenewalRequestRepository) {
        this.integrationRequestRepository = integrationRequestRepository;
        this.sectionRepository = sectionRepository;
        this.fieldChangeRequestRepository = fieldChangeRequestRepository;
        this.documentRenewalRequestRepository = documentRenewalRequestRepository;
    }

    public RevampReviewCaseSummaryDto toSummary(RevampReviewCase reviewCase) {
        RevampIntegrationRequest latestIntegrationRequest = reviewCase.getId() == null || integrationRequestRepository == null
                ? null
                : integrationRequestRepository.findFirstByReviewCaseIdOrderByCreatedAtDesc(reviewCase.getId());

        RevampApplication app = reviewCase.getApplication();
        String registryType = app != null && app.getRegistryType() != null ? app.getRegistryType().name() : null;
        String applicantDisplayName = app != null ? resolveDisplayName(app) : null;
        RevampFieldChangeRequest fieldChangeRequest = reviewCase.getId() == null || fieldChangeRequestRepository == null
                ? null
                : fieldChangeRequestRepository.findByReviewCaseId(reviewCase.getId()).orElse(null);
        RevampDocumentRenewalRequest documentRenewalRequest = reviewCase.getId() == null || documentRenewalRequestRepository == null
                ? null
                : documentRenewalRequestRepository.findByReviewCaseId(reviewCase.getId()).stream().findFirst().orElse(null);
        List<RevampDocumentRenewalRequest> renewalBatch = documentRenewalRequest == null || documentRenewalRequestRepository == null
                ? List.of()
                : documentRenewalRequestRepository.findByApplicationIdAndBatchIdOrderByCreatedAtAsc(
                        documentRenewalRequest.getApplication().getId(),
                        documentRenewalRequest.getBatchId()
                );
        int renewalSubmittedCount = (int) renewalBatch.stream()
                .filter(item -> item.getStatus() == DocumentRenewalRequestStatus.SUBMITTED
                        || item.getStatus() == DocumentRenewalRequestStatus.UNDER_REVIEW
                        || item.getStatus() == DocumentRenewalRequestStatus.APPROVED
                        || item.getStatus() == DocumentRenewalRequestStatus.REJECTED)
                .count();
        int renewalPendingSupplierCount = (int) renewalBatch.stream()
                .filter(item -> item.getStatus() == DocumentRenewalRequestStatus.REMINDER_SENT
                        || item.getStatus() == DocumentRenewalRequestStatus.EXPIRED_NO_RESPONSE)
                .count();
        List<DocumentRenewalRequestDto> activeRenewalRequests = documentRenewalRequest == null
                ? List.of()
                : activeRenewalRequests(app, reviewCase).stream()
                        .map(this::toDocumentRenewalDto)
                        .toList();

        return new RevampReviewCaseSummaryDto(
                reviewCase.getId(),
                app != null ? app.getId() : null,
                app != null ? app.getProtocolCode() : null,
                reviewCase.getStatus() != null ? reviewCase.getStatus().name() : null,
                reviewCase.getDecision() != null ? reviewCase.getDecision().name() : null,
                reviewCase.getAssignedToUser() != null ? reviewCase.getAssignedToUser().getId() : null,
                reviewCase.getAssignedToUser() != null ? reviewCase.getAssignedToUser().getEmail() : null,
                reviewCase.getAssignedAt(),
                reviewCase.getSlaDueAt(),
                reviewCase.getVerifiedByUser() != null ? reviewCase.getVerifiedByUser().getId() : null,
                reviewCase.getVerifiedByUser() != null ? reviewCase.getVerifiedByUser().getEmail() : null,
                reviewCase.getVerifiedAt(),
                reviewCase.getVerificationNote(),
                reviewCase.getVerificationOutcome() != null ? reviewCase.getVerificationOutcome().name() : null,
                reviewCase.getDecidedByUser() != null ? reviewCase.getDecidedByUser().getId() : null,
                reviewCase.getDecidedByUser() != null ? reviewCase.getDecidedByUser().getEmail() : null,
                reviewCase.getDecidedAt(),
                latestIntegrationRequest != null && latestIntegrationRequest.getStatus() != null
                        ? latestIntegrationRequest.getStatus().name()
                        : null,
                latestIntegrationRequest != null ? latestIntegrationRequest.getSupplierRespondedAt() : null,
                reviewCase.getUpdatedAt(),
                registryType,
                applicantDisplayName,
                documentRenewalRequest != null ? "DOCUMENT_RENEWAL" : (fieldChangeRequest != null ? "FIELD_CHANGE" : "APPLICATION"),
                fieldChangeRequest != null ? fieldChangeRequest.getId() : null,
                fieldChangeRequest != null ? fieldChangeRequest.getSectionKey() : null,
                fieldChangeRequest != null && fieldChangeRequest.getStatus() != null ? fieldChangeRequest.getStatus().name() : null,
                fieldChangeRequest != null && fieldChangeRequest.getBeforeValueJson() != null ? fieldChangeRequest.getBeforeValueJson().toString() : null,
                fieldChangeRequest != null && fieldChangeRequest.getAfterValueJson() != null ? fieldChangeRequest.getAfterValueJson().toString() : null,
                documentRenewalRequest != null ? documentRenewalRequest.getId() : null,
                documentRenewalRequest != null && documentRenewalRequest.getStatus() != null ? documentRenewalRequest.getStatus().name() : null,
                documentRenewalRequest != null ? documentRenewalRequest.getSectionKey() : null,
                documentRenewalRequest != null ? documentRenewalRequest.getDocumentType() : null,
                documentRenewalRequest != null ? documentRenewalRequest.getDocumentLabel() : null,
                documentRenewalRequest != null && documentRenewalRequest.getOldAttachmentJson() != null ? documentRenewalRequest.getOldAttachmentJson().toString() : null,
                documentRenewalRequest != null && documentRenewalRequest.getNewAttachmentJson() != null ? documentRenewalRequest.getNewAttachmentJson().toString() : null,
                documentRenewalRequest != null ? renewalSubmittedCount : null,
                documentRenewalRequest != null ? renewalPendingSupplierCount : null,
                activeRenewalRequests
        );
    }

    private List<RevampDocumentRenewalRequest> activeRenewalRequests(RevampApplication app, RevampReviewCase reviewCase) {
        if (app == null || reviewCase == null || documentRenewalRequestRepository == null) return List.of();
        Map<UUID, RevampDocumentRenewalRequest> byId = new LinkedHashMap<>();
        documentRenewalRequestRepository.findByApplicationIdAndStatusIn(
                app.getId(),
                List.of(DocumentRenewalRequestStatus.SUBMITTED, DocumentRenewalRequestStatus.UNDER_REVIEW)
        ).forEach(item -> byId.put(item.getId(), item));
        documentRenewalRequestRepository.findByReviewCaseId(reviewCase.getId())
                .forEach(item -> byId.put(item.getId(), item));
        return byId.values().stream()
                .sorted(Comparator
                        .comparing((RevampDocumentRenewalRequest item) -> item.getSubmittedAt() != null ? item.getSubmittedAt() : item.getCreatedAt())
                        .thenComparing(RevampDocumentRenewalRequest::getDocumentLabel, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    private DocumentRenewalRequestDto toDocumentRenewalDto(RevampDocumentRenewalRequest request) {
        boolean expired = request.getExpiryDate() != null
                && request.getExpiryDate().isBefore(LocalDate.now())
                && (request.getStatus() == DocumentRenewalRequestStatus.REMINDER_SENT
                || request.getStatus() == DocumentRenewalRequestStatus.EXPIRED_NO_RESPONSE);
        return new DocumentRenewalRequestDto(
                request.getId(),
                request.getApplication() != null ? request.getApplication().getId() : null,
                request.getReviewCase() != null ? request.getReviewCase().getId() : null,
                request.getSectionKey(),
                request.getBatchId(),
                request.getDocumentType(),
                request.getDocumentLabel(),
                request.getIntegrationItemCode(),
                request.getCertificationKey(),
                request.getExpiryDate(),
                request.getStatus(),
                request.getOldAttachmentJson() != null ? request.getOldAttachmentJson().toString() : null,
                request.getNewAttachmentJson() != null ? request.getNewAttachmentJson().toString() : null,
                request.getSubmittedAt(),
                request.getCreatedAt(),
                request.getUpdatedAt(),
                expired
        );
    }

    private String resolveDisplayName(RevampApplication app) {
        if (sectionRepository == null) return null;
        return sectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(app.getId(), "S1")
                .map(section -> extractName(app.getRegistryType(), section.getPayloadJson()))
                .orElse(null);
    }

    private String extractName(RegistryType registryType, JsonNode payload) {
        if (payload == null) return null;
        if (registryType == RegistryType.ALBO_B) {
            String company = payload.path("companyName").asText(null);
            if (company != null && !company.isBlank()) return company;
        }
        String first = payload.path("firstName").asText(null);
        String last  = payload.path("lastName").asText(null);
        String full  = ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
        return full.isBlank() ? null : full;
    }
}
