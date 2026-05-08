package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
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

        // Block duplicate active requests for the same section
        fcrRepository.findFirstByApplicationIdAndSectionKeyAndStatusIn(applicationId, sectionKey, ACTIVE_STATUSES)
                .ifPresent(existing -> {
                    throw new IllegalStateException(
                            "An active change request already exists for section " + sectionKey + ".");
                });

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
        sectionRepository.findByApplicationIdAndSectionKeyAndIsLatestTrue(
                fcr.getApplication().getId(), fcr.getSectionKey()
        ).ifPresent(section -> fcr.setBeforeValueJson(section.getPayloadJson()));

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
        RevampApplicationSection updatedSection = sectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(application.getId(), fcr.getSectionKey())
                .orElseThrow(() -> new IllegalStateException(
                        "Section " + fcr.getSectionKey() + " not found for application."));

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

    @Transactional(readOnly = true)
    public List<FieldChangeRequestDto> listForApplication(UUID applicationId) {
        return fcrRepository.findByApplicationIdOrderByCreatedAtDesc(applicationId)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public FieldChangeRequestDto getById(UUID fcrId) {
        return toDto(getFcr(fcrId));
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private RevampFieldChangeRequest getFcr(UUID fcrId) {
        return fcrRepository.findById(fcrId)
                .orElseThrow(() -> new EntityNotFoundException("RevampFieldChangeRequest", fcrId));
    }

    private RevampApplication getApplication(UUID applicationId) {
        return applicationRepository.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampApplication", applicationId));
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
}
