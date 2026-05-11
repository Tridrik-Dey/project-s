package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.DocumentRenewalRequestDto;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.DocumentRenewalRequestStatus;
import com.supplierplatform.revamp.enums.ReviewCaseStatus;
import com.supplierplatform.revamp.enums.ReviewDecision;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import com.supplierplatform.revamp.model.RevampDocumentRenewalRequest;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampDocumentRenewalRequestRepository;
import com.supplierplatform.revamp.repository.RevampReviewCaseRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class RevampDocumentRenewalRequestService {

    private static final List<DocumentRenewalRequestStatus> ACTIVE_STATUSES = List.of(
            DocumentRenewalRequestStatus.REMINDER_SENT,
            DocumentRenewalRequestStatus.SUBMITTED,
            DocumentRenewalRequestStatus.UNDER_REVIEW,
            DocumentRenewalRequestStatus.EXPIRED_NO_RESPONSE
    );

    private final RevampDocumentRenewalRequestRepository renewalRepository;
    private final RevampApplicationRepository applicationRepository;
    private final RevampApplicationSectionRepository sectionRepository;
    private final RevampReviewCaseRepository reviewCaseRepository;
    private final RevampAuditService auditService;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;
    private final RevampDocumentRenewalRequestMailService documentRenewalRequestMailService;
    private final ObjectMapper objectMapper;

    public RevampDocumentRenewalRequestService(
            RevampDocumentRenewalRequestRepository renewalRepository,
            RevampApplicationRepository applicationRepository,
            RevampApplicationSectionRepository sectionRepository,
            RevampReviewCaseRepository reviewCaseRepository,
            RevampAuditService auditService,
            RevampGovernanceAuthorizationService governanceAuthorizationService,
            RevampDocumentRenewalRequestMailService documentRenewalRequestMailService,
            ObjectMapper objectMapper
    ) {
        this.renewalRepository = renewalRepository;
        this.applicationRepository = applicationRepository;
        this.sectionRepository = sectionRepository;
        this.reviewCaseRepository = reviewCaseRepository;
        this.auditService = auditService;
        this.governanceAuthorizationService = governanceAuthorizationService;
        this.documentRenewalRequestMailService = documentRenewalRequestMailService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public boolean createReminderIfAbsent(
            UUID applicationId,
            String batchId,
            String sectionKey,
            String documentType,
            String documentLabel,
            String integrationItemCode,
            String certificationKey,
            JsonNode oldAttachmentJson,
            LocalDate expiryDate
    ) {
        boolean exists = certificationKey == null || certificationKey.isBlank()
                ? renewalRepository.findFirstByApplicationIdAndDocumentTypeAndCertificationKeyIsNullAndStatusIn(
                        applicationId, documentType, ACTIVE_STATUSES
                ).isPresent()
                : renewalRepository.findFirstByApplicationIdAndDocumentTypeAndCertificationKeyAndStatusIn(
                        applicationId, documentType, certificationKey, ACTIVE_STATUSES
                ).isPresent();
        if (exists) {
            return false;
        }

        RevampApplication application = getApplication(applicationId);
        RevampDocumentRenewalRequest request = new RevampDocumentRenewalRequest();
        request.setApplication(application);
        request.setBatchId(batchId);
        request.setSectionKey(sectionKey);
        request.setDocumentType(documentType);
        request.setDocumentLabel(documentLabel);
        request.setIntegrationItemCode(integrationItemCode);
        request.setCertificationKey(certificationKey);
        request.setOldAttachmentJson(oldAttachmentJson);
        request.setExpiryDate(expiryDate);
        request.setStatus(DocumentRenewalRequestStatus.REMINDER_SENT);
        RevampDocumentRenewalRequest saved = renewalRepository.save(request);

        auditService.append(new RevampAuditEventInputDto(
                "document_renewal.reminder_sent",
                "DOCUMENT_RENEWAL_REQUEST",
                saved.getId(),
                null,
                null,
                null,
                "Rinnovo documento richiesto",
                null,
                "{\"status\":\"REMINDER_SENT\"}",
                "{\"applicationId\":\"" + applicationId
                        + "\",\"documentType\":\"" + esc(documentType)
                        + "\",\"batchId\":\"" + esc(batchId)
                        + "\",\"documentLabel\":\"" + esc(documentLabel) + "\"}"
        ));
        return true;
    }

    @Transactional(readOnly = true)
    public List<DocumentRenewalRequestDto> listForApplication(UUID applicationId, UUID currentUserId) {
        RevampApplication application = getApplication(applicationId);
        if (application.getApplicantUser() != null
                && currentUserId != null
                && !application.getApplicantUser().getId().equals(currentUserId)) {
            // Admin calls are allowed by controller role checks through the same endpoint only after authentication.
            try {
                governanceAuthorizationService.resolveAdminGovernanceRole(currentUserId);
            } catch (RuntimeException ex) {
                throw new AccessDeniedException("You do not own this application.");
            }
        }
        return renewalRepository.findByApplicationIdOrderByCreatedAtDesc(applicationId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public DocumentRenewalRequestDto submitRenewal(UUID renewalId, UUID supplierUserId) {
        RevampDocumentRenewalRequest request = getRequest(renewalId);
        return submitBatch(request.getApplication().getId(), request.getBatchId(), supplierUserId).stream()
                .filter(item -> request.getId().equals(item.id()))
                .findFirst()
                .orElseGet(() -> toDto(request));
    }

    @Transactional
    public List<DocumentRenewalRequestDto> submitBatch(UUID applicationId, String batchId, UUID supplierUserId) {
        List<RevampDocumentRenewalRequest> requests = renewalRepository
                .findByApplicationIdAndBatchIdOrderByCreatedAtAsc(applicationId, batchId)
                .stream()
                .filter(request -> request.getStatus() == DocumentRenewalRequestStatus.REMINDER_SENT
                        || request.getStatus() == DocumentRenewalRequestStatus.EXPIRED_NO_RESPONSE)
                .toList();
        if (requests.isEmpty()) {
            throw new IllegalStateException("No open document renewal requests found for this batch.");
        }
        RevampDocumentRenewalRequest first = requests.get(0);
        RevampApplication application = first.getApplication();
        if (application.getApplicantUser() == null || !application.getApplicantUser().getId().equals(supplierUserId)) {
            throw new AccessDeniedException("You do not own this application.");
        }

        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setApplication(application);
        reviewCase.setStatus(ReviewCaseStatus.PENDING_ASSIGNMENT);
        RevampReviewCase savedCase = reviewCaseRepository.save(reviewCase);

        LocalDateTime now = LocalDateTime.now();
        for (RevampDocumentRenewalRequest request : requests) {
            RevampApplicationSection latest = sectionRepository
                    .findByApplicationIdAndSectionKeyAndIsLatestTrue(application.getId(), request.getSectionKey())
                    .orElseThrow(() -> new IllegalStateException("Section not found for document renewal."));
            JsonNode newAttachment = findRenewalEvidence(latest.getPayloadJson(), request);
            if (newAttachment == null || newAttachment.isMissingNode() || newAttachment.isNull()) {
                throw new IllegalStateException("Upload or update the requested document before submitting: " + request.getDocumentLabel());
            }
            validateRenewedExpiry(latest.getPayloadJson(), request);

            request.setNewAttachmentJson(newAttachment.deepCopy());
            request.setReviewCase(savedCase);
            request.setSubmittedAt(now);
            request.setStatus(DocumentRenewalRequestStatus.SUBMITTED);
        }
        List<RevampDocumentRenewalRequest> savedRequests = renewalRepository.saveAll(requests);

        auditService.append(new RevampAuditEventInputDto(
                "document_renewal.batch_submitted",
                "DOCUMENT_RENEWAL_REQUEST",
                first.getId(),
                supplierUserId,
                "SUPPLIER",
                null,
                "Documenti aggiornati inviati in revisione",
                "{\"status\":\"REMINDER_SENT\"}",
                "{\"status\":\"SUBMITTED\"}",
                "{\"applicationId\":\"" + application.getId()
                        + "\",\"reviewCaseId\":\"" + savedCase.getId()
                        + "\",\"batchId\":\"" + esc(batchId)
                        + "\",\"documents\":" + toJsonArray(savedRequests.stream().map(RevampDocumentRenewalRequest::getDocumentLabel).toList()) + "}"
        ));

        return savedRequests.stream().map(this::toDto).toList();
    }

    @Transactional
    public DocumentRenewalRequestDto submitRenewalLegacy(UUID renewalId, UUID supplierUserId) {
        RevampDocumentRenewalRequest request = getRequest(renewalId);
        RevampApplication application = request.getApplication();
        if (application.getApplicantUser() == null || !application.getApplicantUser().getId().equals(supplierUserId)) {
            throw new AccessDeniedException("You do not own this application.");
        }
        if (request.getStatus() != DocumentRenewalRequestStatus.REMINDER_SENT
                && request.getStatus() != DocumentRenewalRequestStatus.EXPIRED_NO_RESPONSE) {
            throw new IllegalStateException("This document renewal request cannot be submitted.");
        }

        RevampApplicationSection latest = sectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(application.getId(), request.getSectionKey())
                .orElseThrow(() -> new IllegalStateException("Section not found for document renewal."));
        JsonNode newAttachment = findRenewalEvidence(latest.getPayloadJson(), request);
        if (newAttachment == null || newAttachment.isMissingNode() || newAttachment.isNull()) {
            throw new IllegalStateException("Upload or update the requested document before submitting.");
        }
        validateRenewedExpiry(latest.getPayloadJson(), request);

        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setApplication(application);
        reviewCase.setStatus(ReviewCaseStatus.PENDING_ASSIGNMENT);
        RevampReviewCase savedCase = reviewCaseRepository.save(reviewCase);

        request.setNewAttachmentJson(newAttachment.deepCopy());
        request.setReviewCase(savedCase);
        request.setSubmittedAt(LocalDateTime.now());
        request.setStatus(DocumentRenewalRequestStatus.SUBMITTED);
        RevampDocumentRenewalRequest saved = renewalRepository.save(request);

        auditService.append(new RevampAuditEventInputDto(
                "document_renewal.submitted",
                "DOCUMENT_RENEWAL_REQUEST",
                saved.getId(),
                supplierUserId,
                "SUPPLIER",
                null,
                "Documento aggiornato inviato in revisione",
                "{\"status\":\"REMINDER_SENT\"}",
                "{\"status\":\"SUBMITTED\"}",
                "{\"applicationId\":\"" + application.getId()
                        + "\",\"reviewCaseId\":\"" + savedCase.getId()
                        + "\",\"documentLabel\":\"" + esc(request.getDocumentLabel()) + "\"}"
        ));

        return toDto(saved);
    }

    @Transactional
    public void markUnderReview(UUID reviewCaseId) {
        renewalRepository.findByReviewCaseId(reviewCaseId).forEach(request -> {
            if (request.getStatus() == DocumentRenewalRequestStatus.SUBMITTED) {
                request.setStatus(DocumentRenewalRequestStatus.UNDER_REVIEW);
                renewalRepository.save(request);
            }
        });
    }

    @Transactional
    public void markUnderReviewForReviewCases(List<UUID> reviewCaseIds) {
        if (reviewCaseIds == null || reviewCaseIds.isEmpty()) return;
        reviewCaseIds.forEach(this::markUnderReview);
    }

    @Transactional
    public void handleReviewDecision(UUID reviewCaseId, ReviewDecision decision, UUID decidedByUserId, String reason) {
        handleReviewDecisionForReviewCases(List.of(reviewCaseId), decision, decidedByUserId, reason);
    }

    @Transactional
    public void handleReviewDecisionForReviewCases(List<UUID> reviewCaseIds, ReviewDecision decision, UUID decidedByUserId, String reason) {
        List<RevampDocumentRenewalRequest> requests = reviewCaseIds == null ? List.of() : reviewCaseIds.stream()
                .flatMap(reviewCaseId -> renewalRepository.findByReviewCaseId(reviewCaseId).stream())
                .distinct()
                .toList();
        if (requests.isEmpty()) {
            return;
        }
        RevampApplication application = requests.get(0).getApplication();
        for (RevampDocumentRenewalRequest request : requests) {
            if (decision == ReviewDecision.APPROVED) {
                request.setStatus(DocumentRenewalRequestStatus.APPROVED);
                currentExpiry(request).ifPresent(request::setExpiryDate);
                application.setStatus(ApplicationStatus.APPROVED);
            } else {
                request.setStatus(DocumentRenewalRequestStatus.REJECTED);
                restoreOldAttachment(request);
                application.setStatus(ApplicationStatus.APPROVED);
            }
            applicationRepository.save(application);
            renewalRepository.save(request);

            auditService.append(new RevampAuditEventInputDto(
                    decision == ReviewDecision.APPROVED ? "document_renewal.approved" : "document_renewal.rejected",
                    "DOCUMENT_RENEWAL_REQUEST",
                    request.getId(),
                    decidedByUserId,
                    resolveActorRole(decidedByUserId),
                    null,
                    null,
                    "{\"status\":\"UNDER_REVIEW\"}",
                    "{\"status\":\"" + request.getStatus().name() + "\"}",
                    "{\"applicationId\":\"" + application.getId()
                            + "\",\"reviewCaseId\":\"" + (request.getReviewCase() != null ? request.getReviewCase().getId() : "")
                            + "\",\"documentLabel\":\"" + esc(request.getDocumentLabel()) + "\"}"
            ));
        }
        documentRenewalRequestMailService.sendOutcomeNotice(requests, decision, reason);
    }

    @Transactional(readOnly = true)
    public List<String> labelsForReviewCase(UUID reviewCaseId) {
        return renewalRepository.findByReviewCaseId(reviewCaseId)
                .stream()
                .map(RevampDocumentRenewalRequest::getDocumentLabel)
                .filter(label -> label != null && !label.isBlank())
                .distinct()
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean hasReviewCase(UUID reviewCaseId) {
        return !renewalRepository.findByReviewCaseId(reviewCaseId).isEmpty();
    }

    @Transactional(readOnly = true)
    public List<UUID> activeReviewCaseIdsForApplication(UUID applicationId, UUID includeReviewCaseId) {
        if (applicationId == null) return includeReviewCaseId == null ? List.of() : List.of(includeReviewCaseId);
        List<UUID> activeIds = renewalRepository.findByApplicationIdAndStatusIn(
                        applicationId,
                        List.of(DocumentRenewalRequestStatus.SUBMITTED, DocumentRenewalRequestStatus.UNDER_REVIEW)
                )
                .stream()
                .map(RevampDocumentRenewalRequest::getReviewCase)
                .filter(reviewCase -> reviewCase != null && reviewCase.getId() != null)
                .map(RevampReviewCase::getId)
                .toList();
        if (includeReviewCaseId == null) {
            return activeIds.stream().distinct().toList();
        }
        return java.util.stream.Stream.concat(activeIds.stream(), java.util.stream.Stream.of(includeReviewCaseId))
                .distinct()
                .toList();
    }

    @Transactional(readOnly = true)
    public List<String> activeLabels(UUID applicationId) {
        return renewalRepository.findByApplicationIdAndStatusIn(applicationId, ACTIVE_STATUSES)
                .stream()
                .map(RevampDocumentRenewalRequest::getDocumentLabel)
                .filter(label -> label != null && !label.isBlank())
                .distinct()
                .toList();
    }

    @Transactional(readOnly = true)
    public List<String> expiredWithoutResponseLabels(UUID applicationId) {
        LocalDate today = LocalDate.now();
        return renewalRepository.findByApplicationIdAndStatusIn(
                        applicationId,
                        List.of(DocumentRenewalRequestStatus.REMINDER_SENT, DocumentRenewalRequestStatus.EXPIRED_NO_RESPONSE)
                )
                .stream()
                .filter(item -> item.getExpiryDate() != null && item.getExpiryDate().isBefore(today))
                .map(RevampDocumentRenewalRequest::getDocumentLabel)
                .filter(label -> label != null && !label.isBlank())
                .distinct()
                .toList();
    }

    private void restoreOldAttachment(RevampDocumentRenewalRequest request) {
        if (request.getOldAttachmentJson() == null || request.getOldAttachmentJson().isNull()) {
            return;
        }
        sectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(request.getApplication().getId(), request.getSectionKey())
                .ifPresent(section -> {
                    JsonNode restored = "S4".equals(request.getSectionKey())
                            && "CERTIFICATION".equals(request.getDocumentType())
                            && request.getCertificationKey() != null
                            && !request.getCertificationKey().isBlank()
                            ? RevampDocumentRenewalJson.restoreCertificationRenewal(
                                    objectMapper,
                                    section.getPayloadJson(),
                                    request.getCertificationKey(),
                                    request.getOldAttachmentJson()
                            )
                            : RevampDocumentRenewalJson.replaceMatchingDocument(
                                    objectMapper,
                                    section.getPayloadJson(),
                                    request.getApplication() != null ? request.getApplication().getRegistryType() : null,
                                    request.getSectionKey(),
                                    request.getDocumentType(),
                                    request.getCertificationKey(),
                                    request.getOldAttachmentJson()
                            );
                    restored = restoreOriginalS1Expiry(restored, request);
                    section.setPayloadJson(restored);
                    sectionRepository.save(section);
                });
    }

    private void validateRenewedExpiry(JsonNode payload, RevampDocumentRenewalRequest request) {
        if (payload == null || request == null || request.getExpiryDate() == null) return;
        if ("S4".equals(request.getSectionKey())
                && "CERTIFICATION".equals(request.getDocumentType())
                && RevampDocumentRenewalJson.isCertificationDeclined(payload, request.getCertificationKey())) {
            return;
        }
        Optional<LocalDate> nextExpiry = currentExpiry(payload, request);
        if (nextExpiry.isEmpty()) {
            throw new IllegalStateException("Update the document expiry date before submitting: " + request.getDocumentLabel());
        }
        if (!nextExpiry.get().isAfter(request.getExpiryDate())) {
            throw new IllegalStateException("The new document expiry date must be after the previous expiry date: " + request.getDocumentLabel());
        }
    }

    private Optional<LocalDate> currentExpiry(RevampDocumentRenewalRequest request) {
        if (request == null || request.getApplication() == null || request.getSectionKey() == null) {
            return Optional.empty();
        }
        return sectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(request.getApplication().getId(), request.getSectionKey())
                .flatMap(section -> currentExpiry(section.getPayloadJson(), request));
    }

    private Optional<LocalDate> currentExpiry(JsonNode payload, RevampDocumentRenewalRequest request) {
        if (payload == null || request == null) return Optional.empty();
        if ("S1".equals(request.getSectionKey()) && "ID_DOCUMENT".equals(request.getDocumentType())) {
            if (request.getApplication() != null && request.getApplication().getRegistryType() == com.supplierplatform.revamp.enums.RegistryType.ALBO_B) {
                return parseExpiryDate(payload.path("legalRepresentative").path("idDocumentExpiry").asText(null))
                        .or(() -> parseExpiryDate(payload.path("lrIdDocumentExpiry").asText(null)));
            }
            return parseExpiryDate(payload.path("idDocumentExpiry").asText(null));
        }
        if ("S4".equals(request.getSectionKey())
                && "CERTIFICATION".equals(request.getDocumentType())
                && request.getCertificationKey() != null
                && !request.getCertificationKey().isBlank()) {
            JsonNode record = RevampDocumentRenewalJson.findCertificationRecord(payload, request.getCertificationKey());
            Optional<LocalDate> recordExpiry = parseExpiryDate(record != null ? record.path("scadenza").asText(null) : null);
            if (recordExpiry.isPresent()) {
                return recordExpiry;
            }
        }
        JsonNode evidence = findRenewalEvidence(payload, request);
        if (evidence == null || evidence.isMissingNode() || evidence.isNull()) {
            evidence = findMatchingAttachment(payload, request);
        }
        if (evidence == null || evidence.isMissingNode() || evidence.isNull()) {
            return Optional.empty();
        }
        JsonNode expiryEvidence = evidence;
        return parseExpiryDate(expiryEvidence.path("expiryDate").asText(null))
                .or(() -> parseExpiryDate(expiryEvidence.path("expiresAt").asText(null)))
                .or(() -> parseExpiryDate(expiryEvidence.path("scadenza").asText(null)));
    }

    private JsonNode restoreOriginalS1Expiry(JsonNode payload, RevampDocumentRenewalRequest request) {
        if (!(payload instanceof ObjectNode copy) || request == null || request.getExpiryDate() == null) return payload;
        if (!"S1".equals(request.getSectionKey()) || !"ID_DOCUMENT".equals(request.getDocumentType())) return payload;
        String expiry = request.getExpiryDate().format(DateTimeFormatter.ISO_LOCAL_DATE);
        if (request.getApplication() != null && request.getApplication().getRegistryType() == com.supplierplatform.revamp.enums.RegistryType.ALBO_B) {
            ObjectNode representative = copy.path("legalRepresentative").isObject()
                    ? (ObjectNode) copy.path("legalRepresentative").deepCopy()
                    : objectMapper.createObjectNode();
            representative.put("idDocumentExpiry", expiry);
            copy.set("legalRepresentative", representative);
            copy.put("lrIdDocumentExpiry", expiry);
            return copy;
        }
        copy.put("idDocumentExpiry", expiry);
        return copy;
    }

    private Optional<LocalDate> parseExpiryDate(String raw) {
        if (raw == null || raw.isBlank()) return Optional.empty();
        String value = raw.trim();
        try {
            return Optional.of(LocalDate.parse(value));
        } catch (DateTimeParseException ignored) {
        }
        try {
            return Optional.of(LocalDateTime.parse(value).toLocalDate());
        } catch (DateTimeParseException ignored) {
        }
        try {
            return Optional.of(YearMonth.parse(value, DateTimeFormatter.ofPattern("MM/yyyy")).atEndOfMonth());
        } catch (DateTimeParseException ignored) {
            return Optional.empty();
        }
    }

    private JsonNode findRenewalEvidence(JsonNode payload, RevampDocumentRenewalRequest request) {
        return RevampDocumentRenewalJson.findRenewalEvidence(
                payload,
                request.getApplication() != null ? request.getApplication().getRegistryType() : null,
                request.getSectionKey(),
                request.getDocumentType(),
                request.getCertificationKey()
        );
    }

    private JsonNode findMatchingAttachment(JsonNode payload, RevampDocumentRenewalRequest request) {
        return RevampDocumentRenewalJson.findMatchingDocument(
                payload,
                request.getApplication() != null ? request.getApplication().getRegistryType() : null,
                request.getSectionKey(),
                request.getDocumentType(),
                request.getCertificationKey()
        );
    }

    public static LocalDate expiryDateFromYearMonth(YearMonth month) {
        return month == null ? null : month.atEndOfMonth();
    }

    private RevampDocumentRenewalRequest getRequest(UUID renewalId) {
        return renewalRepository.findById(renewalId)
                .orElseThrow(() -> new EntityNotFoundException("RevampDocumentRenewalRequest", renewalId));
    }

    private RevampApplication getApplication(UUID applicationId) {
        return applicationRepository.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampApplication", applicationId));
    }

    private DocumentRenewalRequestDto toDto(RevampDocumentRenewalRequest request) {
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

    private String resolveActorRole(UUID actorUserId) {
        if (actorUserId == null) return null;
        try {
            return governanceAuthorizationService.resolveAdminGovernanceRole(actorUserId).name();
        } catch (RuntimeException ex) {
            return "ADMIN";
        }
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
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
}
