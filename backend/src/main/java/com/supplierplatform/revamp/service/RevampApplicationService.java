package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampApplicationSummaryDto;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampIdentityAvailabilityDto;
import com.supplierplatform.revamp.dto.RevampApplicationCommunicationDto;
import com.supplierplatform.revamp.dto.RevampIntegrationRequestSummaryDto;
import com.supplierplatform.revamp.dto.RevampSectionSnapshotDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.DocumentRenewalRequestStatus;
import com.supplierplatform.revamp.enums.FieldChangeRequestStatus;
import com.supplierplatform.revamp.enums.IntegrationRequestStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.enums.ReviewCaseStatus;
import com.supplierplatform.revamp.enums.SourceChannel;
import com.supplierplatform.revamp.mapper.RevampApplicationMapper;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import com.supplierplatform.revamp.model.RevampAuditEvent;
import com.supplierplatform.revamp.model.RevampDocumentRenewalRequest;
import com.supplierplatform.revamp.model.RevampFieldChangeRequest;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import com.supplierplatform.revamp.model.RevampNotificationEvent;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfile;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampApplicationAttachmentRepository;
import com.supplierplatform.revamp.repository.RevampAuditEventRepository;
import com.supplierplatform.revamp.repository.RevampDocumentRenewalRequestRepository;
import com.supplierplatform.revamp.repository.RevampFieldChangeRequestRepository;
import com.supplierplatform.revamp.repository.RevampIntegrationRequestRepository;
import com.supplierplatform.revamp.repository.RevampNotificationEventRepository;
import com.supplierplatform.revamp.repository.RevampReviewCaseRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import com.supplierplatform.revamp.repository.RevampOtpChallengeRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileRepository;
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
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
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
    private final RevampFieldChangeRequestRepository fieldChangeRequestRepository;
    private final RevampDocumentRenewalRequestRepository documentRenewalRequestRepository;
    private final RevampSupplierRegistryProfileRepository supplierRegistryProfileRepository;
    private final RevampNotificationEventRepository notificationEventRepository;
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
        JsonNode rawPayload = parseJsonRequired(payloadJson, "payloadJson");
        JsonNode scopedPayload = applyFieldChangeRequestScope(application, sectionKey, rawPayload);
        scopedPayload = applyIntegrationRequestScope(application, sectionKey, scopedPayload);
        scopedPayload = applyDocumentRenewalRequestScope(application, sectionKey, scopedPayload);

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
        JsonNode validatedPayload = sectionPayloadValidator.validateAndNormalize(
                application.getRegistryType(),
                sectionKey,
                scopedPayload,
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

    private JsonNode applyFieldChangeRequestScope(RevampApplication application, String sectionKey, JsonNode incomingPayload) {
        List<RevampFieldChangeRequest> unlockedRequests = fieldChangeRequestRepository
                .findByApplicationIdAndStatusIn(application.getId(), List.of(FieldChangeRequestStatus.UNLOCKED))
                .stream()
                .filter(fcr -> sectionKey.equals(parentSectionKey(application.getId(), fcr.getSectionKey())))
                .toList();

        if (unlockedRequests.isEmpty()) {
            return incomingPayload;
        }

        RevampApplicationSection currentSection = applicationSectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(application.getId(), sectionKey)
                .orElse(null);
        if (currentSection == null || !currentSection.getPayloadJson().isObject() || !incomingPayload.isObject()) {
            return incomingPayload;
        }

        Set<String> allowedRootFields = new HashSet<>();
        unlockedRequests.forEach(fcr -> allowedRootFields.addAll(allowedRootFieldsForFcrGroup(fcr.getSectionKey())));
        if (allowedRootFields.isEmpty()) {
            return currentSection.getPayloadJson();
        }

        ObjectNode merged = currentSection.getPayloadJson().deepCopy();
        ObjectNode incomingObject = (ObjectNode) incomingPayload;
        for (String field : allowedRootFields) {
            if (incomingObject.has(field)) {
                merged.set(field, incomingObject.get(field));
            } else {
                merged.remove(field);
            }
        }
        return merged;
    }

    private JsonNode applyIntegrationRequestScope(RevampApplication application, String sectionKey, JsonNode incomingPayload) {
        RevampIntegrationRequest openRequest = integrationRequestRepository
                .findFirstByReviewCaseApplicationIdAndStatusOrderByCreatedAtDesc(application.getId(), IntegrationRequestStatus.OPEN);
        if (openRequest == null) {
            return incomingPayload;
        }

        RevampApplicationSection currentSection = applicationSectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(application.getId(), sectionKey)
                .orElse(null);
        if (currentSection == null || !currentSection.getPayloadJson().isObject() || !incomingPayload.isObject()) {
            return incomingPayload;
        }

        Set<String> allowedRootFields = allowedRootFieldsForIntegration(application.getRegistryType(), sectionKey, openRequest.getRequestedItemsJson());
        if (allowedRootFields.isEmpty()) {
            return currentSection.getPayloadJson();
        }

        ObjectNode merged = currentSection.getPayloadJson().deepCopy();
        ObjectNode incomingObject = (ObjectNode) incomingPayload;
        for (String field : allowedRootFields) {
            if (incomingObject.has(field)) {
                merged.set(field, incomingObject.get(field));
            } else {
                merged.remove(field);
            }
        }
        return merged;
    }

    private JsonNode applyDocumentRenewalRequestScope(RevampApplication application, String sectionKey, JsonNode incomingPayload) {
        List<RevampDocumentRenewalRequest> activeRequests = documentRenewalRequestRepository
                .findByApplicationIdAndStatusIn(application.getId(), List.of(
                        DocumentRenewalRequestStatus.REMINDER_SENT,
                        DocumentRenewalRequestStatus.EXPIRED_NO_RESPONSE
                ))
                .stream()
                .filter(request -> sectionKey.equals(request.getSectionKey()))
                .toList();
        if (activeRequests.isEmpty()) {
            return incomingPayload;
        }

        RevampApplicationSection currentSection = applicationSectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(application.getId(), sectionKey)
                .orElse(null);
        if (currentSection == null || !currentSection.getPayloadJson().isObject() || !incomingPayload.isObject()) {
            return incomingPayload;
        }

        JsonNode merged = currentSection.getPayloadJson().deepCopy();
        for (RevampDocumentRenewalRequest request : activeRequests) {
            if ("S4".equals(request.getSectionKey())
                    && "CERTIFICATION".equals(request.getDocumentType())
                    && request.getCertificationKey() != null
                    && !request.getCertificationKey().isBlank()) {
                merged = RevampDocumentRenewalJson.mergeCertificationRenewal(
                        objectMapper,
                        merged,
                        incomingPayload,
                        request.getCertificationKey()
                );
                continue;
            }
            JsonNode incomingAttachment = RevampDocumentRenewalJson.findMatchingDocument(
                    incomingPayload,
                    application.getRegistryType(),
                    request.getSectionKey(),
                    request.getDocumentType(),
                    request.getCertificationKey()
            );
            if (incomingAttachment != null && !incomingAttachment.isMissingNode() && !incomingAttachment.isNull()) {
                merged = RevampDocumentRenewalJson.replaceMatchingDocument(
                        objectMapper,
                        merged,
                        application.getRegistryType(),
                        request.getSectionKey(),
                        request.getDocumentType(),
                        request.getCertificationKey(),
                        incomingAttachment
                );
            }
        }
        return merged;
    }

    private String parentSectionKey(UUID applicationId, String fcrGroupKey) {
        return switch (fcrGroupKey) {
            case "foto_profilo", "dati_personali", "dati_fiscali", "indirizzo", "contatti",
                 "dati_aziendali", "identificativi", "sede_legale", "sede_operativa",
                 "contatti_inst", "leg_rappr", "ref_operativo" -> "S1";
            case "tipo_prof", "comp_secondarie", "ateco", "dimensione", "ateco_b",
                 "regioni_op", "acc_formazione", "terzo_settore" -> "S2";
            case "servizi_cat" -> "S3";
            case "servizi_offerti", "cert_specifiche" -> "S3B";
            case "istruzione", "territorio" -> applicationSectionRepository
                    .findByApplicationIdAndSectionKeyAndIsLatestTrue(applicationId, "S3B")
                    .isPresent() ? "S3B" : "S3A";
            case "competenze", "lingue", "tariffe", "esperienze" -> "S3A";
            case "cap_operativa", "referenze", "allegati", "certificazioni", "allegati_b" -> "S4";
            case "dichiarazioni", "dichiarazioni_b" -> "S5";
            default -> fcrGroupKey;
        };
    }

    private static Set<String> allowedRootFieldsForFcrGroup(String fcrGroupKey) {
        return switch (fcrGroupKey) {
            case "foto_profilo" -> Set.of("profilePhotoAttachment", "idDocumentExpiry");
            case "dati_personali" -> Set.of("firstName", "lastName", "birthDate", "birthPlace");
            case "dati_fiscali" -> Set.of("taxCode", "vatNumber", "taxRegime", "taxRegimeOther");
            case "indirizzo" -> Set.of("country", "address", "addressLine", "city", "province", "postalCode");
            case "contatti" -> Set.of("phone", "secondaryPhone", "phoneCode", "phoneSecondary", "phoneSecondaryCode", "email", "secondaryEmail", "emailSecondary", "pec", "website", "linkedin");
            case "dati_aziendali" -> Set.of("companyName", "legalForm");
            case "identificativi" -> Set.of("vatNumber", "taxCodeIfDifferent", "reaNumber", "cciaaProvince", "incorporationDate");
            case "sede_legale" -> Set.of("legalAddress");
            case "sede_operativa" -> Set.of("operationalHeadquarter");
            case "contatti_inst" -> Set.of("institutionalEmail", "pec", "phone", "website");
            case "leg_rappr" -> Set.of("legalRepresentative");
            case "ref_operativo" -> Set.of("operationalContact");
            case "tipo_prof" -> Set.of("tipologia", "professionalType");
            case "comp_secondarie" -> Set.of("multiRuoli", "secondaryProfessionalTypes");
            case "ateco" -> Set.of("ateco", "atecoCode");
            case "dimensione" -> Set.of("employeeRange", "revenueBand");
            case "ateco_b" -> Set.of("atecoPrimary", "atecoSecondary", "atecoMain", "atecoSecondari");
            case "regioni_op" -> Set.of("operatingRegions");
            case "acc_formazione" -> Set.of("regionalTrainingAccreditation");
            case "terzo_settore" -> Set.of("thirdSectorType", "runtsNumber");
            case "istruzione" -> Set.of("education", "titoloStudio", "ambitoStudio", "annoConseg", "certAbitazioni", "professionalOrder", "ordine", "highestTitle", "titoloB", "studyArea", "ambitoB", "experienceBand", "anniEsp", "hourlyRateRange");
            case "competenze" -> Set.of("competencies", "thematicAreasCsv", "aree", "docenzaPA", "consultingAreasCsv", "consulenza");
            case "territorio" -> Set.of("presentation", "areaTerritoriale", "consultingAreasCsv", "territoryRegionsCsv", "territoryProvincesCsv", "territory", "areaTerrB");
            case "lingue" -> Set.of("languages", "lingue", "teachingLanguagesCsv", "lingueDocenza", "digitalToolsCsv", "strumenti", "professionalNetworksCsv", "reti");
            case "tariffe" -> Set.of("availability", "disponibilita", "areeSpecifiche", "tariffaGiorn", "tariffaOra", "tariffaOraB", "hourlyRateRange");
            case "esperienze" -> Set.of("experiences", "esperienze", "espCount", "committenti", "tipiIntervento", "periodi");
            case "servizi_offerti" -> Set.of("services", "servizi", "altroServ");
            case "cert_specifiche" -> Set.of("specificCertifications", "certB");
            case "servizi_cat" -> Set.of("serviceCategoriesCsv", "servicesDescription", "servicesByCategory", "descriptionsByCategory");
            case "cap_operativa" -> Set.of("operationalCapacity", "disponibilita", "areeSpecifiche", "tariffaGiorn", "tariffaOra", "areaTerrB", "tariffaOraB");
            case "referenze" -> Set.of("references", "referenze");
            case "allegati", "allegati_b" -> Set.of("attachments", "cvName", "certName");
            case "certificazioni" -> Set.of("iso9001", "accreditationSummary", "certificationsNotes");
            case "dichiarazioni", "dichiarazioni_b" -> Set.of(
                    "truthfulnessDeclaration", "noConflictOfInterest", "noCriminalConvictions",
                    "privacyAccepted", "ethicalCodeAccepted", "qualityEnvSafetyAccepted",
                    "alboDataProcessingConsent", "marketingConsent", "dlgs81ComplianceWhenInPresence",
                    "antimafiaDeclaration", "dlgs231Declaration", "model231Adopted",
                    "fiscalContributionRegularity", "gdprComplianceAndDpo", "otpChallengeId",
                    "otpVerified", "otpVerifiedAt", "otpCode"
            );
            default -> Set.of();
        };
    }

    private static Set<String> allowedRootFieldsForIntegration(RegistryType registryType, String sectionKey, JsonNode requestedItemsJson) {
        JsonNode items = requestedItemsJson == null ? null : requestedItemsJson.path("items");
        if (items == null || !items.isArray()) {
            return Set.of();
        }
        Set<String> fields = new HashSet<>();
        for (JsonNode item : items) {
            String code = item.path("code").asText("");
            fields.addAll(allowedRootFieldsForIntegrationItem(registryType, sectionKey, code));
        }
        return fields;
    }

    private static Set<String> allowedRootFieldsForIntegrationItem(RegistryType registryType, String sectionKey, String code) {
        String normalized = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if ("S1".equals(sectionKey)) {
            return switch (normalized) {
                case "ID_DOCUMENT" -> registryType == RegistryType.ALBO_B
                        ? Set.of("legalRepresentative")
                        : Set.of("profilePhotoAttachment", "idDocumentExpiry");
                default -> Set.of();
            };
        }
        if ("S4".equals(sectionKey)) {
            return switch (normalized) {
                case "CV", "PROFESSIONAL_CERTIFICATION", "PROFESSIONAL_REGISTER",
                     "VISURA_CAMERALE", "DURC", "COMPANY_PROFILE",
                     "CERT_ISO_9001", "CERT_ISO_14001", "CERT_ISO_45001", "CERT_SA8000",
                     "CERTIFICATIONS_ACCREDITATIONS" -> Set.of("attachments", "cvName", "certName");
                default -> Set.of();
            };
        }
        if ("S3A".equals(sectionKey)) {
            return switch (normalized) {
                case "THEMATIC_SPECIFICATION" -> Set.of(
                        "competencies", "thematicAreasCsv", "aree", "docenzaPA",
                        "consultingAreasCsv", "consulenza", "presentation", "areaTerritoriale"
                );
                case "EXPERIENCE_CONSISTENCY" -> Set.of(
                        "experiences", "esperienze", "espCount", "committenti", "tipiIntervento", "periodi"
                );
                default -> Set.of();
            };
        }
        if ("S3B".equals(sectionKey)) {
            return switch (normalized) {
                case "THEMATIC_SPECIFICATION" -> Set.of(
                        "services", "servizi", "altroServ", "specificCertifications", "certB"
                );
                case "EXPERIENCE_CONSISTENCY" -> Set.of("experienceBand", "anniEsp");
                default -> Set.of();
            };
        }
        if ("S3".equals(sectionKey) && registryType == RegistryType.ALBO_B) {
            return switch (normalized) {
                case "THEMATIC_SPECIFICATION" -> Set.of(
                        "serviceCategoriesCsv", "servicesDescription", "servicesByCategory", "descriptionsByCategory"
                );
                default -> Set.of();
            };
        }
        return Set.of();
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

        List<RevampAuditEvent> applicationEvents = auditEventRepository
                .findByEntityTypeAndEntityIdOrderByOccurredAtDesc("REVAMP_APPLICATION", applicationId);
        List<UUID> fieldChangeIds = fieldChangeRequestRepository.findByApplicationIdOrderByCreatedAtDesc(applicationId)
                .stream()
                .map(RevampFieldChangeRequest::getId)
                .toList();
        Stream<RevampAuditEvent> fieldChangeEvents = fieldChangeIds.isEmpty()
                ? Stream.empty()
                : auditEventRepository
                        .findByEntityTypeAndEntityIdInOrderByOccurredAtDesc("FIELD_CHANGE_REQUEST", fieldChangeIds)
                        .stream();
        Stream<RevampApplicationCommunicationDto> notificationCommunications = supplierRegistryProfileRepository
                .findByApplicationId(applicationId)
                .stream()
                .map(RevampSupplierRegistryProfile::getId)
                .flatMap(profileId -> notificationEventRepository
                        .findByEntityTypeAndEntityIdOrderByCreatedAtDesc("REVAMP_SUPPLIER_PROFILE", profileId)
                        .stream())
                .map(this::toCommunication)
                .filter(message -> message != null);

        return Stream.concat(
                        Stream.concat(applicationEvents.stream(), fieldChangeEvents)
                                .map(this::toCommunication)
                                .filter(message -> message != null),
                        notificationCommunications
                )
                .sorted(Comparator.comparing(RevampApplicationCommunicationDto::occurredAt).reversed())
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
                request.getSupplierResponseJson(),
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

    @Transactional
    public RevampApplicationSummaryDto completeIntegrationItem(UUID applicationId, UUID currentUserId, String itemCode) {
        RevampApplication application = getApplication(applicationId);
        if (application.getApplicantUser() == null || !application.getApplicantUser().getId().equals(currentUserId)) {
            throw new AccessDeniedException("Not authorized to answer this integration request");
        }
        ApplicationStatus beforeStatus = application.getStatus();
        if (beforeStatus != ApplicationStatus.INTEGRATION_REQUIRED) {
            throw new IllegalStateException("Application cannot answer integration from status: " + beforeStatus);
        }

        RevampIntegrationRequest openRequest = integrationRequestRepository
                .findFirstByReviewCaseApplicationIdAndStatusOrderByCreatedAtDesc(applicationId, IntegrationRequestStatus.OPEN);
        if (openRequest == null) {
            throw new IllegalStateException("No open integration request found for this application");
        }

        String normalizedCode = normalizeIntegrationItemCode(itemCode);
        Set<String> requestedCodes = requestedIntegrationItemCodes(openRequest.getRequestedItemsJson());
        if (requestedCodes.isEmpty()) {
            return answerIntegration(applicationId, currentUserId);
        }
        if (!requestedCodes.contains(normalizedCode)) {
            throw new IllegalArgumentException("Integration item is not part of this request: " + itemCode);
        }

        Set<String> completedCodes = completedIntegrationItemCodes(openRequest.getSupplierResponseJson());
        completedCodes.add(normalizedCode);
        openRequest.setSupplierResponseJson(buildSupplierResponseJson(application, openRequest.getSupplierResponseJson(), completedCodes, false));
        integrationRequestRepository.save(openRequest);

        if (!completedCodes.containsAll(requestedCodes)) {
            String actorRole = application.getApplicantUser() != null && application.getApplicantUser().getRole() != null
                    ? application.getApplicantUser().getRole().name()
                    : null;
            auditService.append(new RevampAuditEventInputDto(
                    "revamp.application.integration.item_completed",
                    "REVAMP_APPLICATION",
                    application.getId(),
                    application.getApplicantUser() != null ? application.getApplicantUser().getId() : null,
                    actorRole,
                    null,
                    null,
                    "{\"status\":\"" + beforeStatus.name() + "\"}",
                    "{\"status\":\"" + application.getStatus().name() + "\"}",
                    "{\"integrationRequestId\":\"" + openRequest.getId() + "\",\"itemCode\":\"" + esc(normalizedCode) + "\"}"
            ));
            return applicationMapper.toSummary(application);
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
                "{\"integrationRequestId\":\"" + answeredRequest.getId() + "\",\"completedItemCodes\":\"" + esc(String.join(",", completedCodes)) + "\"}"
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

    private String normalizeIntegrationItemCode(String code) {
        if (code == null || code.trim().isEmpty()) {
            throw new IllegalArgumentException("Integration item code is required");
        }
        return code.trim().toUpperCase(Locale.ROOT);
    }

    private Set<String> requestedIntegrationItemCodes(JsonNode requestedItemsJson) {
        Set<String> codes = new HashSet<>();
        JsonNode items = requestedItemsJson == null ? null : requestedItemsJson.path("items");
        if (items == null || !items.isArray()) {
            return codes;
        }
        for (JsonNode item : items) {
            JsonNode codeNode = item.path("code");
            if (codeNode.isTextual() && !codeNode.asText().trim().isEmpty()) {
                codes.add(codeNode.asText().trim().toUpperCase(Locale.ROOT));
            }
        }
        return codes;
    }

    private Set<String> completedIntegrationItemCodes(JsonNode supplierResponseJson) {
        Set<String> codes = new HashSet<>();
        JsonNode nodes = supplierResponseJson == null ? null : supplierResponseJson.path("completedItemCodes");
        if (nodes == null || !nodes.isArray()) {
            return codes;
        }
        for (JsonNode node : nodes) {
            if (node.isTextual() && !node.asText().trim().isEmpty()) {
                codes.add(node.asText().trim().toUpperCase(Locale.ROOT));
            }
        }
        return codes;
    }

    private ObjectNode buildSupplierResponseJson(
            RevampApplication application,
            JsonNode existingResponse,
            Set<String> completedCodes,
            boolean submitted
    ) {
        ObjectNode response = existingResponse != null && existingResponse.isObject()
                ? ((ObjectNode) existingResponse).deepCopy()
                : objectMapper.createObjectNode();
        LocalDateTime now = LocalDateTime.now();
        response.put("applicationId", application.getId().toString());
        response.put("updatedAt", now.toString());
        if (submitted) {
            response.put("submittedAt", now.toString());
        }
        ArrayNode completedArray = objectMapper.createArrayNode();
        completedCodes.stream().sorted().forEach(completedArray::add);
        response.set("completedItemCodes", completedArray);
        return response;
    }

    private RevampIntegrationRequest closeOpenIntegrationRequest(RevampApplication application) {
        RevampIntegrationRequest openRequest = integrationRequestRepository
                .findFirstByReviewCaseApplicationIdAndStatusOrderByCreatedAtDesc(application.getId(), IntegrationRequestStatus.OPEN);
        if (openRequest == null) return null;

        Set<String> completedCodes = completedIntegrationItemCodes(openRequest.getSupplierResponseJson());
        Set<String> requestedCodes = requestedIntegrationItemCodes(openRequest.getRequestedItemsJson());
        if (completedCodes.isEmpty()) {
            completedCodes.addAll(requestedCodes);
        }
        openRequest.setStatus(IntegrationRequestStatus.ANSWERED);
        openRequest.setSupplierRespondedAt(LocalDateTime.now());
        openRequest.setSupplierResponseJson(buildSupplierResponseJson(application, openRequest.getSupplierResponseJson(), completedCodes, true));
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
            case "revamp.review.verified" -> "Verifica documentale completata";
            case "revamp.review.integration_requested" -> "Richiesta integrazione inviata";
            case "revamp.application.integration.answered" -> "Integrazione ricevuta";
            case "revamp.review.decided" -> decisionMessage(event);
            case "revamp.albo-b.legal-rep-id.expiry-reminder.sent" -> "Promemoria: la carta d'identita del rappresentante legale scade tra 30 giorni.";
            case "revamp.albo-b.cert-expiry-reminder.sent" -> "Promemoria: documenti e certificazioni in scadenza il mese prossimo.";
            case "revamp.carta-identita.expiry-reminder.sent" -> "Promemoria: la tua carta d'identità scade tra 30 giorni.";
            case "fcr.created" -> "Richiesta modifica dati inviata" + fieldChangeSectionSuffix(event);
            case "fcr.unlocked" -> "Modifica dati sbloccata" + fieldChangeSectionSuffix(event);
            case "fcr.cancelled_by_supplier" -> "Richiesta modifica dati annullata dal fornitore" + fieldChangeSectionSuffix(event);
            case "fcr.rejected_by_admin" -> "Richiesta modifica dati respinta" + fieldChangeSectionSuffix(event);
            case "fcr.submitted" -> "Modifica dati inviata in revisione" + fieldChangeSectionSuffix(event);
            case "fcr.approved" -> "Modifica dati approvata" + fieldChangeSectionSuffix(event);
            case "fcr.rejected" -> "Modifica dati respinta" + fieldChangeSectionSuffix(event);
            default -> null;
        };
        return message == null ? null : new RevampApplicationCommunicationDto(event.getEventKey(), message, event.getOccurredAt());
    }

    private RevampApplicationCommunicationDto toCommunication(RevampNotificationEvent event) {
        String message = switch (event.getEventKey()) {
            case "admin.compose-email" -> {
                String subject = event.getPayloadJson() != null && event.getPayloadJson().hasNonNull("subject")
                        ? event.getPayloadJson().path("subject").asText()
                        : "";
                yield subject == null || subject.isBlank()
                        ? "Email inviata dal team Solco"
                        : "Email inviata dal team Solco - " + subject;
            }
            default -> null;
        };
        LocalDateTime occurredAt = event.getSentAt() != null ? event.getSentAt() : event.getCreatedAt();
        return message == null ? null : new RevampApplicationCommunicationDto(event.getEventKey(), message, occurredAt);
    }

    private String fieldChangeSectionSuffix(RevampAuditEvent event) {
        JsonNode metadata = event.getMetadataJson();
        String sectionKey = metadata != null && metadata.hasNonNull("sectionKey")
                ? metadata.path("sectionKey").asText()
                : "";
        return sectionKey == null || sectionKey.isBlank() ? "" : " - Sezione " + sectionKey;
    }

    private String decisionMessage(RevampAuditEvent event) {
        JsonNode metadata = event.getMetadataJson();
        String decision = metadata != null && metadata.hasNonNull("decision") ? metadata.path("decision").asText() : "";
        String reviewType = metadata != null && metadata.hasNonNull("reviewType") ? metadata.path("reviewType").asText() : "";
        if ("DOCUMENT_RENEWAL".equals(reviewType)) {
            return switch (decision) {
                case "APPROVED" -> "Rinnovo documenti approvato";
                case "REJECTED" -> "Rinnovo documenti respinto";
                default -> "Decisione rinnovo documenti registrata";
            };
        }
        if ("FIELD_CHANGE".equals(reviewType)) {
            return switch (decision) {
                case "APPROVED" -> "Modifica dati approvata";
                case "REJECTED" -> "Modifica dati respinta";
                default -> "Decisione modifica dati registrata";
            };
        }
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
