package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampApplicationSummaryDto;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampIdentityAvailabilityDto;
import com.supplierplatform.revamp.dto.RevampApplicationCommunicationDto;
import com.supplierplatform.revamp.dto.RevampIntegrationRequestSummaryDto;
import com.supplierplatform.revamp.dto.RevampSectionSnapshotDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.IntegrationRequestStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.enums.ReviewCaseStatus;
import com.supplierplatform.revamp.enums.SourceChannel;
import com.supplierplatform.revamp.mapper.RevampApplicationMapper;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import com.supplierplatform.revamp.model.RevampAuditEvent;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampApplicationAttachmentRepository;
import com.supplierplatform.revamp.repository.RevampAuditEventRepository;
import com.supplierplatform.revamp.repository.RevampIntegrationRequestRepository;
import com.supplierplatform.revamp.repository.RevampReviewCaseRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import com.supplierplatform.revamp.repository.RevampOtpChallengeRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class RevampApplicationService {

    private static final String TAX_CODE_IDENTITY = "TAX_CODE";
    private static final String VAT_NUMBER_IDENTITY = "VAT_NUMBER";
    private static final List<ApplicationStatus> IDENTITY_BLOCKING_STATUSES = List.of(
            ApplicationStatus.DRAFT,
            ApplicationStatus.SUBMITTED,
            ApplicationStatus.UNDER_REVIEW,
            ApplicationStatus.INTEGRATION_REQUIRED,
            ApplicationStatus.APPROVED,
            ApplicationStatus.SUSPENDED,
            ApplicationStatus.RENEWAL_DUE
    );

    private final RevampApplicationRepository applicationRepository;
    private final RevampApplicationSectionRepository applicationSectionRepository;
    private final RevampApplicationAttachmentRepository applicationAttachmentRepository;
    private final RevampInviteRepository inviteRepository;
    private final RevampReviewCaseRepository reviewCaseRepository;
    private final RevampIntegrationRequestRepository integrationRequestRepository;
    private final RevampOtpChallengeRepository otpChallengeRepository;
    private final RevampAuditEventRepository auditEventRepository;
    private final UserRepository userRepository;
    private final RevampApplicationMapper applicationMapper;
    private final RevampProtocolCodeService protocolCodeService;
    private final RevampAuditService auditService;
    private final RevampSectionPayloadValidator sectionPayloadValidator;
    private final RevampAttachmentService attachmentService;
    private final RevampDraftPayloadUpConverter draftPayloadUpConverter;
    private final ObjectMapper objectMapper;

    @Value("${app.file.upload-dir}")
    private String uploadDir;

    @Transactional
    public RevampApplicationSummaryDto createDraft(
            UUID applicantUserId,
            RegistryType registryType,
            SourceChannel sourceChannel,
            UUID inviteId
    ) {
        User applicant = userRepository.findById(applicantUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", applicantUserId));

        RevampApplication application = new RevampApplication();
        application.setApplicantUser(applicant);
        application.setRegistryType(registryType);
        application.setSourceChannel(sourceChannel);
        application.setStatus(ApplicationStatus.DRAFT);
        application.setCurrentRevision(1);

        if (inviteId != null) {
            RevampInvite invite = inviteRepository.findById(inviteId)
                    .orElseThrow(() -> new EntityNotFoundException("RevampInvite", inviteId));
            application.setInvite(invite);
        }

        RevampApplication saved = applicationRepository.save(application);
        String actorRole = applicant.getRole() != null ? applicant.getRole().name() : null;
        auditService.append(new RevampAuditEventInputDto(
                "revamp.application.created",
                "REVAMP_APPLICATION",
                saved.getId(),
                applicantUserId,
                actorRole,
                null,
                null,
                "{\"status\":null}",
                "{\"status\":\"DRAFT\"}",
                "{\"source\":\"" + sourceChannel.name() + "\",\"applicantName\":\"" + esc(applicant.getEmail()) + "\"}"
        ));
        return applicationMapper.toSummary(saved);
    }

    @Transactional(readOnly = true)
    public RevampApplicationSummaryDto getSummary(UUID applicationId) {
        return applicationMapper.toSummary(getApplication(applicationId));
    }

    @Transactional(readOnly = true)
    public List<RevampApplicationSummaryDto> listForApplicant(UUID applicantUserId) {
        return applicationRepository.findByApplicantUserId(applicantUserId).stream()
                .map(applicationMapper::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public RevampApplicationSummaryDto getLatestForApplicant(UUID applicantUserId) {
        return applicationRepository.findFirstByApplicantUserIdOrderByUpdatedAtDesc(applicantUserId)
                .map(applicationMapper::toSummary)
                .orElse(null);
    }

    @Transactional
    public RevampSectionSnapshotDto saveLatestSection(
            UUID applicationId,
            String sectionKey,
            String payloadJson,
            boolean completed
    ) {
        RevampApplication application = getApplication(applicationId);

        applicationSectionRepository.findByApplicationIdAndSectionKeyAndIsLatestTrue(applicationId, sectionKey)
                .ifPresent(existing -> {
                    existing.setIsLatest(false);
                    applicationSectionRepository.save(existing);
                });

        int nextVersion = applicationSectionRepository
                .findTopByApplicationIdAndSectionKeyOrderBySectionVersionDesc(applicationId, sectionKey)
                .map(s -> s.getSectionVersion() + 1)
                .orElse(1);

        RevampApplicationSection section = new RevampApplicationSection();
        section.setApplication(application);
        section.setSectionKey(sectionKey);
        section.setSectionVersion(nextVersion);
        JsonNode rawPayload = parseJsonRequired(payloadJson, "payloadJson");
        JsonNode validatedPayload = sectionPayloadValidator.validateAndNormalize(
                application.getRegistryType(),
                sectionKey,
                rawPayload,
                completed,
                () -> applicationSectionRepository
                        .findByApplicationIdAndSectionKeyAndIsLatestTrue(applicationId, "S3A")
                        .map(RevampApplicationSection::getPayloadJson)
        );
        updateApplicationIdentityIfNeeded(application, sectionKey, validatedPayload);
        JsonNode enrichedPayload = attachmentService.syncAndEnrich(application, sectionKey, validatedPayload);
        section.setPayloadJson(enrichedPayload);
        section.setCompleted(completed);
        section.setIsLatest(true);
        section.setValidatedAt(LocalDateTime.now());

        RevampApplicationSection saved = applicationSectionRepository.save(section);
        return applicationMapper.toSectionSnapshot(saved);
    }

    @Transactional(readOnly = true)
    public RevampIdentityAvailabilityDto checkIdentityAvailability(
            UUID applicationId,
            String field,
            String value
    ) {
        RevampApplication application = getApplication(applicationId);
        IdentityCandidate candidate = identityCandidateForField(application.getRegistryType(), field, value);
        if (candidate == null || candidate.valueNormalized().isBlank()) {
            return new RevampIdentityAvailabilityDto(true, field, null);
        }

        boolean duplicate = applicationRepository.existsBlockingIdentity(
                application.getRegistryType(),
                candidate.keyType(),
                candidate.valueNormalized(),
                IDENTITY_BLOCKING_STATUSES,
                applicationId
        );
        return new RevampIdentityAvailabilityDto(
                !duplicate,
                candidate.field(),
                duplicate ? candidate.messageKey() : null
        );
    }

    @Transactional
    public void deleteOwnDraft(UUID applicationId, UUID currentUserId) {
        RevampApplication application = getApplication(applicationId);
        if (application.getApplicantUser() == null || !application.getApplicantUser().getId().equals(currentUserId)) {
            throw new AccessDeniedException("Not authorized to delete this application draft");
        }
        deleteDraft(application);
    }

    @Transactional
    public int deleteStaleDraftsOlderThanDays(int days) {
        if (days < 1) {
            throw new IllegalArgumentException("days must be at least 1");
        }
        LocalDateTime cutoff = LocalDateTime.now().minusDays(days);
        List<RevampApplication> staleDrafts = applicationRepository.findByStatusAndUpdatedAtBefore(
                ApplicationStatus.DRAFT,
                cutoff
        );
        staleDrafts.forEach(this::deleteDraft);
        return staleDrafts.size();
    }

    @Transactional(readOnly = true)
    public List<RevampSectionSnapshotDto> getLatestSections(UUID applicationId) {
        RevampApplication application = getApplication(applicationId);
        return applicationSectionRepository.findByApplicationIdAndIsLatestTrue(applicationId).stream()
                .map(section -> {
                    JsonNode converted = draftPayloadUpConverter.convertForDraftRead(
                            application.getRegistryType(),
                            section.getSectionKey(),
                            section.getPayloadJson()
                    );
                    return new RevampSectionSnapshotDto(
                            section.getId(),
                            section.getApplication() != null ? section.getApplication().getId() : null,
                            section.getSectionKey(),
                            section.getSectionVersion(),
                            Boolean.TRUE.equals(section.getCompleted()),
                            converted == null ? null : converted.toString(),
                            section.getUpdatedAt()
                    );
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<RevampApplicationCommunicationDto> getCommunications(UUID applicationId, UUID currentUserId) {
        RevampApplication application = getApplication(applicationId);
        if (application.getApplicantUser() == null || !application.getApplicantUser().getId().equals(currentUserId)) {
            throw new AccessDeniedException("Not authorized to read communications for this application");
        }

        return auditEventRepository.findByEntityTypeAndEntityIdOrderByOccurredAtDesc("REVAMP_APPLICATION", applicationId).stream()
                .map(this::toCommunication)
                .filter(message -> message != null)
                .toList();
    }

    @Transactional(readOnly = true)
    public RevampIntegrationRequestSummaryDto getOpenIntegrationRequest(UUID applicationId, UUID currentUserId) {
        RevampApplication application = getApplication(applicationId);
        if (application.getApplicantUser() == null || !application.getApplicantUser().getId().equals(currentUserId)) {
            throw new AccessDeniedException("Not authorized to read integration requests for this application");
        }

        RevampIntegrationRequest request = integrationRequestRepository
                .findFirstByReviewCaseApplicationIdAndStatusOrderByCreatedAtDesc(applicationId, IntegrationRequestStatus.OPEN);
        if (request == null) {
            return null;
        }
        return new RevampIntegrationRequestSummaryDto(
                request.getId(),
                request.getReviewCase() != null ? request.getReviewCase().getId() : null,
                request.getStatus() != null ? request.getStatus().name() : null,
                request.getDueAt(),
                request.getRequestMessage(),
                request.getRequestedItemsJson(),
                request.getUpdatedAt()
        );
    }

    @Transactional
    public RevampApplicationSummaryDto submit(UUID applicationId) {
        RevampApplication application = getApplication(applicationId);
        ApplicationStatus status = application.getStatus();
        ApplicationStatus beforeStatus = status;

        if (status != ApplicationStatus.DRAFT && status != ApplicationStatus.INTEGRATION_REQUIRED) {
            throw new IllegalStateException("Application cannot be submitted from status: " + status);
        }

        ensureIdentityFromLatestSection(application);
        assertIdentityAvailable(application);

        if (status == ApplicationStatus.INTEGRATION_REQUIRED) {
            closeOpenIntegrationRequest(application);
            application.setStatus(ApplicationStatus.UNDER_REVIEW);
        } else {
            application.setStatus(ApplicationStatus.SUBMITTED);
        }
        application.setSubmittedAt(LocalDateTime.now());
        if (application.getProtocolCode() == null || application.getProtocolCode().isBlank()) {
            application.setProtocolCode(protocolCodeService.nextProtocolCode(application.getRegistryType()));
        }

        RevampApplication saved = applicationRepository.save(application);
        if (beforeStatus == ApplicationStatus.DRAFT) {
            ensurePendingReviewCase(saved);
        }
        String actorRole = saved.getApplicantUser() != null && saved.getApplicantUser().getRole() != null
                ? saved.getApplicantUser().getRole().name()
                : null;
        auditService.append(new RevampAuditEventInputDto(
                "revamp.application.submitted",
                "REVAMP_APPLICATION",
                saved.getId(),
                saved.getApplicantUser() != null ? saved.getApplicantUser().getId() : null,
                actorRole,
                null,
                null,
                "{\"status\":\"" + beforeStatus.name() + "\"}",
                "{\"status\":\"" + saved.getStatus().name() + "\"}",
                "{\"protocolCode\":\"" + saved.getProtocolCode() + "\",\"applicantName\":\"" + esc(saved.getApplicantUser() != null ? saved.getApplicantUser().getEmail() : "") + "\"}"
        ));
        if (beforeStatus == ApplicationStatus.INTEGRATION_REQUIRED) {
            auditService.append(new RevampAuditEventInputDto(
                    "revamp.application.integration.answered",
                    "REVAMP_APPLICATION",
                    saved.getId(),
                    saved.getApplicantUser() != null ? saved.getApplicantUser().getId() : null,
                    actorRole,
                    null,
                    null,
                    "{\"status\":\"" + beforeStatus.name() + "\"}",
                    "{\"status\":\"" + saved.getStatus().name() + "\"}",
                    "{\"protocolCode\":\"" + saved.getProtocolCode() + "\",\"applicantName\":\"" + esc(saved.getApplicantUser() != null ? saved.getApplicantUser().getEmail() : "") + "\"}"
            ));
        }
        return applicationMapper.toSummary(saved);
    }

    @Transactional
    public RevampApplicationSummaryDto answerIntegration(UUID applicationId, UUID currentUserId) {
        RevampApplication application = getApplication(applicationId);
        if (application.getApplicantUser() == null || !application.getApplicantUser().getId().equals(currentUserId)) {
            throw new AccessDeniedException("Not authorized to answer this integration request");
        }
        ApplicationStatus beforeStatus = application.getStatus();
        if (beforeStatus != ApplicationStatus.INTEGRATION_REQUIRED) {
            throw new IllegalStateException("Application cannot answer integration from status: " + beforeStatus);
        }

        RevampIntegrationRequest answeredRequest = closeOpenIntegrationRequest(application);
        if (answeredRequest == null) {
            throw new IllegalStateException("No open integration request found for this application");
        }

        application.setStatus(ApplicationStatus.UNDER_REVIEW);
        RevampApplication saved = applicationRepository.save(application);
        String actorRole = saved.getApplicantUser() != null && saved.getApplicantUser().getRole() != null
                ? saved.getApplicantUser().getRole().name()
                : null;
        auditService.append(new RevampAuditEventInputDto(
                "revamp.application.integration.answered",
                "REVAMP_APPLICATION",
                saved.getId(),
                saved.getApplicantUser() != null ? saved.getApplicantUser().getId() : null,
                actorRole,
                null,
                null,
                "{\"status\":\"" + beforeStatus.name() + "\"}",
                "{\"status\":\"" + saved.getStatus().name() + "\"}",
                "{\"integrationRequestId\":\"" + answeredRequest.getId() + "\",\"applicantName\":\"" + esc(saved.getApplicantUser() != null ? saved.getApplicantUser().getEmail() : "") + "\"}"
        ));
        return applicationMapper.toSummary(saved);
    }

    private void ensurePendingReviewCase(RevampApplication application) {
        List<RevampReviewCase> activeCases = reviewCaseRepository
                .findByApplicationIdAndStatusNotInOrderByUpdatedAtDesc(
                        application.getId(),
                        List.of(ReviewCaseStatus.DECIDED, ReviewCaseStatus.CLOSED)
                );
        if (!activeCases.isEmpty()) {
            return;
        }

        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setApplication(application);
        reviewCase.setStatus(ReviewCaseStatus.PENDING_ASSIGNMENT);
        reviewCaseRepository.save(reviewCase);
    }

    private void updateApplicationIdentityIfNeeded(RevampApplication application, String sectionKey, JsonNode payload) {
        if (!"S1".equalsIgnoreCase(sectionKey)) {
            return;
        }
        IdentityCandidate candidate = identityCandidateForPayload(application.getRegistryType(), payload);
        if (candidate == null || candidate.valueNormalized().isBlank()) {
            application.setIdentityKeyType(null);
            application.setIdentityValueNormalized(null);
            applicationRepository.save(application);
            return;
        }
        assertIdentityAvailable(application, candidate);
        application.setIdentityKeyType(candidate.keyType());
        application.setIdentityValueNormalized(candidate.valueNormalized());
        applicationRepository.save(application);
    }

    private void ensureIdentityFromLatestSection(RevampApplication application) {
        if (application.getIdentityKeyType() != null && application.getIdentityValueNormalized() != null) {
            return;
        }
        Optional.ofNullable(applicationSectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(application.getId(), "S1"))
                .orElse(Optional.empty())
                .map(RevampApplicationSection::getPayloadJson)
                .map(payload -> identityCandidateForPayload(application.getRegistryType(), payload))
                .ifPresent(candidate -> {
                    if (candidate.valueNormalized().isBlank()) return;
                    assertIdentityAvailable(application, candidate);
                    application.setIdentityKeyType(candidate.keyType());
                    application.setIdentityValueNormalized(candidate.valueNormalized());
                    applicationRepository.save(application);
                });
    }

    private void assertIdentityAvailable(RevampApplication application) {
        if (application.getIdentityKeyType() == null || application.getIdentityValueNormalized() == null) {
            return;
        }
        IdentityCandidate candidate = identityCandidateForStored(application);
        assertIdentityAvailable(application, candidate);
    }

    private void assertIdentityAvailable(RevampApplication application, IdentityCandidate candidate) {
        boolean duplicate = applicationRepository.existsBlockingIdentity(
                application.getRegistryType(),
                candidate.keyType(),
                candidate.valueNormalized(),
                IDENTITY_BLOCKING_STATUSES,
                application.getId()
        );
        if (duplicate) {
            throw new IllegalStateException(candidate.messageKey());
        }
    }

    private void deleteDraft(RevampApplication application) {
        if (application.getStatus() != ApplicationStatus.DRAFT) {
            throw new IllegalStateException("Only DRAFT applications can be deleted");
        }
        UUID applicationId = application.getId();
        otpChallengeRepository.deleteByApplicationId(applicationId);
        applicationAttachmentRepository.deleteByApplicationId(applicationId);
        applicationSectionRepository.deleteByApplicationId(applicationId);
        applicationRepository.delete(application);
        applicationRepository.flush();
        deleteUploadedFiles(applicationId);
    }

    private void deleteUploadedFiles(UUID applicationId) {
        if (uploadDir == null || uploadDir.isBlank()) return;
        Path targetDir = Paths.get(uploadDir).toAbsolutePath().normalize()
                .resolve("revamp")
                .resolve(applicationId.toString())
                .normalize();
        Path uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
        if (!targetDir.startsWith(uploadRoot) || !Files.exists(targetDir)) return;
        try (Stream<Path> paths = Files.walk(targetDir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                }
            });
        } catch (IOException ignored) {
        }
    }

    private IdentityCandidate identityCandidateForPayload(RegistryType registryType, JsonNode payload) {
        if (registryType == RegistryType.ALBO_A) {
            return new IdentityCandidate("taxCode", TAX_CODE_IDENTITY, normalizeIdentity(extractText(payload, "taxCode")), "validation.duplicate.taxId");
        }
        if (registryType == RegistryType.ALBO_B) {
            String value = firstNonBlank(extractText(payload, "vatNumber"), extractText(payload, "piva"));
            return new IdentityCandidate("vatNumber", VAT_NUMBER_IDENTITY, normalizeIdentity(value), "validation.duplicate.vatNumber");
        }
        return null;
    }

    private IdentityCandidate identityCandidateForField(RegistryType registryType, String field, String value) {
        String normalizedField = field == null ? "" : field.trim();
        if (registryType == RegistryType.ALBO_A && "taxCode".equals(normalizedField)) {
            return new IdentityCandidate("taxCode", TAX_CODE_IDENTITY, normalizeIdentity(value), "validation.duplicate.taxId");
        }
        if (registryType == RegistryType.ALBO_B && ("vatNumber".equals(normalizedField) || "piva".equals(normalizedField))) {
            return new IdentityCandidate("vatNumber", VAT_NUMBER_IDENTITY, normalizeIdentity(value), "validation.duplicate.vatNumber");
        }
        throw new IllegalArgumentException("Field " + field + " is not a unique identity field for " + registryType);
    }

    private IdentityCandidate identityCandidateForStored(RevampApplication application) {
        String field = VAT_NUMBER_IDENTITY.equals(application.getIdentityKeyType()) ? "vatNumber" : "taxCode";
        String messageKey = VAT_NUMBER_IDENTITY.equals(application.getIdentityKeyType())
                ? "validation.duplicate.vatNumber"
                : "validation.duplicate.taxId";
        return new IdentityCandidate(field, application.getIdentityKeyType(), application.getIdentityValueNormalized(), messageKey);
    }

    private String normalizeIdentity(String value) {
        if (value == null) return "";
        return value.replaceAll("\\s+", "").trim().toUpperCase(Locale.ROOT);
    }

    private String extractText(JsonNode node, String field) {
        if (node == null || node.isNull()) return null;
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) return null;
        if (value.isTextual() || value.isNumber() || value.isBoolean()) return value.asText();
        return value.toString();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) return value;
        }
        return null;
    }

    private RevampIntegrationRequest closeOpenIntegrationRequest(RevampApplication application) {
        RevampIntegrationRequest openRequest = integrationRequestRepository
                .findFirstByReviewCaseApplicationIdAndStatusOrderByCreatedAtDesc(application.getId(), IntegrationRequestStatus.OPEN);
        if (openRequest == null) return null;

        openRequest.setStatus(IntegrationRequestStatus.ANSWERED);
        openRequest.setSupplierRespondedAt(LocalDateTime.now());
        openRequest.setSupplierResponseJson(objectMapper.createObjectNode()
                .put("applicationId", application.getId().toString())
                .put("submittedAt", LocalDateTime.now().toString()));
        integrationRequestRepository.save(openRequest);

        RevampReviewCase reviewCase = openRequest.getReviewCase();
        if (reviewCase != null && reviewCase.getStatus() == ReviewCaseStatus.WAITING_SUPPLIER_RESPONSE) {
            reviewCase.setStatus(ReviewCaseStatus.IN_PROGRESS);
            reviewCase.setDecision(null);
            reviewCase.setVerifiedAt(null);
            reviewCase.setVerificationOutcome(null);
            reviewCase.setVerificationNote(null);
            reviewCase.setVerifiedByUser(null);
            reviewCaseRepository.save(reviewCase);
        }
        return openRequest;
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private RevampApplicationCommunicationDto toCommunication(RevampAuditEvent event) {
        String message = switch (event.getEventKey()) {
            case "revamp.application.submitted" -> "Candidatura ricevuta";
            case "revamp.review.opened" -> "Candidatura presa in carico";
            case "revamp.review.verified" -> "Verifica documentale completata";
            case "revamp.review.integration_requested" -> "Richiesta integrazione inviata";
            case "revamp.application.integration.answered" -> "Integrazione ricevuta";
            case "revamp.review.decided" -> decisionMessage(event);
            case "revamp.carta-identita.expiry-reminder.sent" -> "Promemoria: la tua carta d'identità scade tra 30 giorni.";
            default -> null;
        };
        return message == null ? null : new RevampApplicationCommunicationDto(event.getEventKey(), message, event.getOccurredAt());
    }

    private String decisionMessage(RevampAuditEvent event) {
        JsonNode metadata = event.getMetadataJson();
        String decision = metadata != null && metadata.hasNonNull("decision") ? metadata.path("decision").asText() : "";
        return switch (decision) {
            case "APPROVED" -> "Candidatura approvata";
            case "REJECTED" -> "Candidatura non approvata";
            default -> "Decisione registrata";
        };
    }

    private RevampApplication getApplication(UUID applicationId) {
        return applicationRepository.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampApplication", applicationId));
    }

    private JsonNode parseJsonRequired(String raw, String fieldName) {
        String normalized = (raw == null || raw.isBlank()) ? "{}" : raw;
        try {
            return objectMapper.readTree(normalized);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Invalid JSON for " + fieldName, ex);
        }
    }

    private record IdentityCandidate(String field, String keyType, String valueNormalized, String messageKey) {
    }
}
