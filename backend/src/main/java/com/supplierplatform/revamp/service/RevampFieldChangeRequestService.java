package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.AdminFieldChangeRequestRowDto;
import com.supplierplatform.revamp.dto.FieldChangeRequestDto;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.FieldChangeRequestStatus;
import com.supplierplatform.revamp.enums.ReviewCaseStatus;
import com.supplierplatform.revamp.enums.ReviewDecision;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import com.supplierplatform.revamp.model.RevampFieldChangeRequest;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfile;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileDetailRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileRepository;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampFieldChangeRequestRepository;
import com.supplierplatform.revamp.repository.RevampReviewCaseRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampFieldChangeRequestService {

    private static final List<FieldChangeRequestStatus> ACTIVE_STATUSES = List.of(
            FieldChangeRequestStatus.PENDING_ADMIN_REVIEW,
            FieldChangeRequestStatus.UNLOCKED,
            FieldChangeRequestStatus.SUBMITTED,
            FieldChangeRequestStatus.UNDER_REVIEW
    );

    private final RevampFieldChangeRequestRepository fcrRepository;
    private final RevampApplicationRepository applicationRepository;
    private final RevampApplicationSectionRepository sectionRepository;
    private final RevampReviewCaseRepository reviewCaseRepository;
    private final RevampSupplierRegistryProfileRepository profileRepository;
    private final RevampSupplierRegistryProfileDetailRepository profileDetailRepository;
    private final UserRepository userRepository;
    private final RevampAuditService auditService;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;
    private final ObjectMapper objectMapper;

    // ── Supplier: create a change request ──────────────────────────────────

    @Transactional
    public FieldChangeRequestDto createRequest(UUID applicationId, UUID supplierUserId,
                                               String sectionKey, String supplierMessage) {
        RevampApplication application = getApplication(applicationId);

        if (application.getStatus() != ApplicationStatus.APPROVED) {
            throw new IllegalStateException("Field change requests are only allowed for approved applications.");
        }
        if (!application.getApplicantUser().getId().equals(supplierUserId)) {
            throw new AccessDeniedException("You do not own this application.");
        }

        if (!fcrRepository.findByApplicationIdAndStatusIn(applicationId, ACTIVE_STATUSES).isEmpty()) {
            throw new IllegalStateException("An active change request already exists for this application.");
        }

        RevampFieldChangeRequest fcr = new RevampFieldChangeRequest();
        fcr.setApplication(application);
        fcr.setSectionKey(sectionKey);
        fcr.setSupplierMessage(supplierMessage);
        fcr.setStatus(FieldChangeRequestStatus.PENDING_ADMIN_REVIEW);

        RevampFieldChangeRequest saved = fcrRepository.save(fcr);

        auditService.append(new RevampAuditEventInputDto(
                "fcr.created",
                "FIELD_CHANGE_REQUEST",
                saved.getId(),
                supplierUserId,
                "SUPPLIER",
                null,
                null,
                null,
                "{\"status\":\"PENDING_ADMIN_REVIEW\"}",
                "{\"applicationId\":\"" + applicationId
                        + "\",\"sectionKey\":\"" + esc(sectionKey)
                        + "\",\"message\":\"" + esc(supplierMessage) + "\"}"
        ));

        return toDto(saved);
    }

    // ── Admin: unlock the section for editing ──────────────────────────────

    @Transactional
    public FieldChangeRequestDto unlockSection(UUID fcrId, UUID adminUserId, String adminNote) {
        RevampFieldChangeRequest fcr = getFcr(fcrId);

        if (fcr.getStatus() != FieldChangeRequestStatus.PENDING_ADMIN_REVIEW) {
            throw new IllegalStateException("Only PENDING_ADMIN_REVIEW requests can be unlocked.");
        }

        // Snapshot the current section value for the audit trail
        String applicationSectionKey = parentSectionKey(fcr.getApplication().getId(), fcr.getSectionKey());
        JsonNode approvedSnapshot = approvedProjectedSection(fcr.getApplication().getId(), applicationSectionKey);
        if (approvedSnapshot != null && !approvedSnapshot.isMissingNode() && !approvedSnapshot.isNull()) {
            fcr.setBeforeValueJson(approvedSnapshot);
        } else {
            sectionRepository.findByApplicationIdAndSectionKeyAndIsLatestTrue(
                    fcr.getApplication().getId(), applicationSectionKey
            ).ifPresent(section -> fcr.setBeforeValueJson(section.getPayloadJson()));
        }

        User admin = getUser(adminUserId);
        fcr.setUnlockedByUser(admin);
        fcr.setUnlockedAt(LocalDateTime.now());
        fcr.setAdminNote(adminNote);
        fcr.setStatus(FieldChangeRequestStatus.UNLOCKED);

        RevampFieldChangeRequest saved = fcrRepository.save(fcr);

        auditService.append(new RevampAuditEventInputDto(
                "fcr.unlocked",
                "FIELD_CHANGE_REQUEST",
                saved.getId(),
                adminUserId,
                resolveActorRole(adminUserId),
                null,
                adminNote,
                "{\"status\":\"PENDING_ADMIN_REVIEW\"}",
                "{\"status\":\"UNLOCKED\"}",
                "{\"applicationId\":\"" + fcr.getApplication().getId()
                        + "\",\"sectionKey\":\"" + esc(fcr.getSectionKey())
                        + "\",\"applicationSectionKey\":\"" + esc(applicationSectionKey)
                        + "\",\"adminEmail\":\"" + esc(admin.getEmail()) + "\"}"
        ));

        return toDto(saved);
    }

    // ── Admin: reject the unlock request ──────────────────────────────────

    @Transactional
    public FieldChangeRequestDto rejectByAdmin(UUID fcrId, UUID adminUserId, String adminNote) {
        RevampFieldChangeRequest fcr = getFcr(fcrId);

        if (fcr.getStatus() != FieldChangeRequestStatus.PENDING_ADMIN_REVIEW) {
            throw new IllegalStateException("Only PENDING_ADMIN_REVIEW requests can be rejected.");
        }

        User admin = getUser(adminUserId);
        fcr.setUnlockedByUser(admin);
        fcr.setAdminNote(adminNote);
        fcr.setStatus(FieldChangeRequestStatus.REJECTED_BY_ADMIN);

        RevampFieldChangeRequest saved = fcrRepository.save(fcr);

        auditService.append(new RevampAuditEventInputDto(
                "fcr.rejected_by_admin",
                "FIELD_CHANGE_REQUEST",
                saved.getId(),
                adminUserId,
                resolveActorRole(adminUserId),
                null,
                adminNote,
                "{\"status\":\"PENDING_ADMIN_REVIEW\"}",
                "{\"status\":\"REJECTED_BY_ADMIN\"}",
                "{\"applicationId\":\"" + fcr.getApplication().getId()
                        + "\",\"sectionKey\":\"" + esc(fcr.getSectionKey())
                        + "\",\"adminEmail\":\"" + esc(admin.getEmail()) + "\"}"
        ));

        return toDto(saved);
    }

    // ── Supplier: submit the updated section into review ───────────────────

    @Transactional
    public FieldChangeRequestDto submitChange(UUID fcrId, UUID supplierUserId) {
        RevampFieldChangeRequest fcr = getFcr(fcrId);
        RevampApplication application = fcr.getApplication();

        if (fcr.getStatus() != FieldChangeRequestStatus.UNLOCKED) {
            throw new IllegalStateException("Only UNLOCKED requests can be submitted.");
        }
        if (!application.getApplicantUser().getId().equals(supplierUserId)) {
            throw new AccessDeniedException("You do not own this application.");
        }

        // Snapshot the updated section value for the audit trail
        String applicationSectionKey = parentSectionKey(application.getId(), fcr.getSectionKey());
        RevampApplicationSection updatedSection = sectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(application.getId(), applicationSectionKey)
                .orElseThrow(() -> new IllegalStateException(
                        "Section " + applicationSectionKey + " not found for application."));

        fcr.setAfterValueJson(updatedSection.getPayloadJson());
        fcr.setSubmittedAt(LocalDateTime.now());
        fcr.setStatus(FieldChangeRequestStatus.SUBMITTED);

        // Create a review case for Revisore → Responsabile pipeline
        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setApplication(application);
        reviewCase.setStatus(ReviewCaseStatus.PENDING_ASSIGNMENT);
        RevampReviewCase savedCase = reviewCaseRepository.save(reviewCase);

        fcr.setReviewCase(savedCase);

        // Move application into the review holding status
        ApplicationStatus previousStatus = application.getStatus();
        application.setStatus(ApplicationStatus.FIELD_CHANGE_IN_PROGRESS);
        applicationRepository.save(application);

        RevampFieldChangeRequest saved = fcrRepository.save(fcr);

        auditService.append(new RevampAuditEventInputDto(
                "fcr.submitted",
                "FIELD_CHANGE_REQUEST",
                saved.getId(),
                supplierUserId,
                "SUPPLIER",
                null,
                null,
                "{\"status\":\"UNLOCKED\",\"appStatus\":\"" + previousStatus.name() + "\"}",
                "{\"status\":\"SUBMITTED\",\"appStatus\":\"FIELD_CHANGE_IN_PROGRESS\"}",
                "{\"applicationId\":\"" + application.getId()
                        + "\",\"sectionKey\":\"" + esc(fcr.getSectionKey())
                        + "\",\"applicationSectionKey\":\"" + esc(applicationSectionKey)
                        + "\",\"reviewCaseId\":\"" + savedCase.getId() + "\"}"
        ));

        return toDto(saved);
    }

    // ── Called by review pipeline after Responsabile decides ──────────────

    @Transactional
    public void handleReviewDecision(UUID reviewCaseId, ReviewDecision decision, UUID decidedByUserId) {
        fcrRepository.findByReviewCaseId(reviewCaseId).ifPresent(fcr -> {
            RevampApplication application = fcr.getApplication();

            if (decision == ReviewDecision.APPROVED) {
                fcr.setStatus(FieldChangeRequestStatus.APPROVED);
                // Restore the application to APPROVED — profile projection already applied the new section
                application.setStatus(ApplicationStatus.APPROVED);
            } else {
                fcr.setStatus(FieldChangeRequestStatus.REJECTED);
                restoreBeforeValue(fcr);
                application.setStatus(ApplicationStatus.APPROVED);
            }

            applicationRepository.save(application);
            fcrRepository.save(fcr);

            auditService.append(new RevampAuditEventInputDto(
                    decision == ReviewDecision.APPROVED ? "fcr.approved" : "fcr.rejected",
                    "FIELD_CHANGE_REQUEST",
                    fcr.getId(),
                    decidedByUserId,
                    resolveActorRole(decidedByUserId),
                    null,
                    null,
                    "{\"status\":\"UNDER_REVIEW\"}",
                    "{\"status\":\"" + fcr.getStatus().name() + "\",\"appStatus\":\"APPROVED\"}",
                    "{\"applicationId\":\"" + application.getId()
                            + "\",\"sectionKey\":\"" + esc(fcr.getSectionKey())
                            + "\",\"reviewCaseId\":\"" + reviewCaseId + "\"}"
            ));
        });
    }

    // ── Queries ────────────────────────────────────────────────────────────

    @Transactional
    public void markUnderReview(UUID reviewCaseId) {
        fcrRepository.findByReviewCaseId(reviewCaseId).ifPresent(fcr -> {
            if (fcr.getStatus() == FieldChangeRequestStatus.SUBMITTED) {
                fcr.setStatus(FieldChangeRequestStatus.UNDER_REVIEW);
                fcrRepository.save(fcr);
            }
        });
    }

    @Transactional(readOnly = true)
    public List<FieldChangeRequestDto> listForApplication(UUID applicationId) {
        return fcrRepository.findByApplicationIdOrderByCreatedAtDesc(applicationId)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<AdminFieldChangeRequestRowDto> listPendingForAdmin() {
        return fcrRepository.findByStatusOrderByCreatedAtDesc(FieldChangeRequestStatus.PENDING_ADMIN_REVIEW)
                .stream()
                .map(this::toAdminRow)
                .toList();
    }

    @Transactional(readOnly = true)
    public FieldChangeRequestDto getById(UUID fcrId) {
        return toDto(getFcr(fcrId));
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public boolean hasReviewCase(UUID reviewCaseId) {
        return fcrRepository.findByReviewCaseId(reviewCaseId).isPresent();
    }

    private RevampFieldChangeRequest getFcr(UUID fcrId) {
        return fcrRepository.findById(fcrId)
                .orElseThrow(() -> new EntityNotFoundException("RevampFieldChangeRequest", fcrId));
    }

    private RevampApplication getApplication(UUID applicationId) {
        return applicationRepository.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampApplication", applicationId));
    }

    private void restoreBeforeValue(RevampFieldChangeRequest fcr) {
        if (fcr.getApplication() == null || fcr.getBeforeValueJson() == null || fcr.getBeforeValueJson().isNull()) {
            return;
        }
        String applicationSectionKey = parentSectionKey(fcr.getApplication().getId(), fcr.getSectionKey());
        sectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(fcr.getApplication().getId(), applicationSectionKey)
                .ifPresent(section -> {
                    try {
                        section.setPayloadJson(fcr.getBeforeValueJson());
                        sectionRepository.save(section);
                    } catch (Exception ex) {
                        throw new IllegalStateException("Cannot restore rejected field change section.", ex);
                    }
                });
    }

    private JsonNode approvedProjectedSection(UUID applicationId, String sectionKey) {
        return profileRepository.findByApplicationId(applicationId)
                .flatMap(profile -> profileDetailRepository.findByProfileId(profile.getId()))
                .map(detail -> {
                    JsonNode projected = detail.getProjectedJson();
                    if (projected == null) return null;
                    return projected.path("sections").path(sectionKey);
                })
                .orElse(null);
    }

    private AdminFieldChangeRequestRowDto toAdminRow(RevampFieldChangeRequest fcr) {
        RevampApplication application = fcr.getApplication();
        RevampSupplierRegistryProfile profile = application != null && application.getId() != null
                ? profileRepository.findByApplicationId(application.getId()).orElse(null)
                : null;
        String displayName = profile != null && profile.getDisplayName() != null && !profile.getDisplayName().isBlank()
                ? profile.getDisplayName()
                : resolveApplicationDisplayName(application);
        String supplierEmail = application != null && application.getApplicantUser() != null
                ? application.getApplicantUser().getEmail()
                : null;
        return new AdminFieldChangeRequestRowDto(
                fcr.getId(),
                application != null ? application.getId() : null,
                application != null ? application.getProtocolCode() : null,
                application != null ? application.getRegistryType() : null,
                displayName,
                supplierEmail,
                fcr.getSectionKey(),
                fcr.getSupplierMessage(),
                fcr.getStatus(),
                fcr.getCreatedAt(),
                fcr.getUpdatedAt()
        );
    }

    private String resolveApplicationDisplayName(RevampApplication application) {
        if (application == null || application.getId() == null) return null;
        return sectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(application.getId(), "S1")
                .map(RevampApplicationSection::getPayloadJson)
                .map(payload -> {
                    String company = payload.path("companyName").asText("").trim();
                    if (!company.isBlank()) return company;
                    String firstName = payload.path("firstName").asText("").trim();
                    String lastName = payload.path("lastName").asText("").trim();
                    String fullName = (firstName + " " + lastName).trim();
                    if (!fullName.isBlank()) return fullName;
                    String legalRep = payload.path("legalRepresentativeName").asText("").trim();
                    return legalRep.isBlank() ? null : legalRep;
                })
                .orElse(null);
    }

    private User getUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", userId));
    }

    private String resolveActorRole(UUID actorUserId) {
        if (actorUserId == null) return null;
        try {
            return governanceAuthorizationService.resolveAdminGovernanceRole(actorUserId).name();
        } catch (RuntimeException ex) {
            return "ADMIN";
        }
    }

    private FieldChangeRequestDto toDto(RevampFieldChangeRequest fcr) {
        return new FieldChangeRequestDto(
                fcr.getId(),
                fcr.getApplication() != null ? fcr.getApplication().getId() : null,
                fcr.getSectionKey(),
                fcr.getSupplierMessage(),
                fcr.getStatus(),
                fcr.getAdminNote(),
                fcr.getUnlockedByUser() != null ? fcr.getUnlockedByUser().getEmail() : null,
                fcr.getUnlockedAt(),
                fcr.getSubmittedAt(),
                fcr.getBeforeValueJson() != null ? fcr.getBeforeValueJson().toString() : null,
                fcr.getAfterValueJson() != null ? fcr.getAfterValueJson().toString() : null,
                fcr.getReviewCase() != null ? fcr.getReviewCase().getId() : null,
                fcr.getCreatedAt(),
                fcr.getUpdatedAt()
        );
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
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
            case "istruzione", "territorio" -> sectionRepository
                    .findByApplicationIdAndSectionKeyAndIsLatestTrue(applicationId, "S3B")
                    .isPresent() ? "S3B" : "S3A";
            case "competenze", "lingue", "tariffe", "esperienze" -> "S3A";
            case "cap_operativa", "referenze", "allegati", "certificazioni", "allegati_b" -> "S4";
            case "dichiarazioni", "dichiarazioni_b" -> "S5";
            default -> fcrGroupKey;
        };
    }
}
