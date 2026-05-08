package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.ComposeEmailRequest;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampAuditEventSummaryDto;
import com.supplierplatform.revamp.dto.RevampSupplierProfileDto;
import com.supplierplatform.revamp.dto.RevampSupplierProfileTimelineEventDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.RegistryProfileStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampNotificationEvent;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfile;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfileDetail;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileDetailRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import com.supplierplatform.revamp.config.SmtpConfigStore;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.Comparator;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RevampSupplierProfileService {

    private static final String ENTITY_TYPE = "REVAMP_SUPPLIER_PROFILE";

    private final RevampSupplierRegistryProfileRepository profileRepository;
    private final RevampSupplierRegistryProfileDetailRepository profileDetailRepository;
    private final RevampAuditService auditService;
    private final JavaMailSender mailSender;
    private final RevampNotificationEventService notificationEventService;
    private final SmtpConfigStore smtpConfigStore;

    @Value("${app.reviews.status-mail.from:${spring.mail.username:no-reply@supplierplatform.local}}")
    private String fromAddress;

    @Value("${spring.mail.host:smtp.gmail.com}")
    private String mailHost;

    @Value("${spring.mail.port:587}")
    private int mailPort;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Transactional(readOnly = true)
    public RevampSupplierProfileDto getProfile(UUID profileId, User currentUser) {
        RevampSupplierRegistryProfile profile = getProfileEntity(profileId);
        validateReadAccess(profile, currentUser);
        RevampSupplierRegistryProfileDetail detail = profileDetailRepository.findByProfileId(profileId).orElse(null);
        return toDto(profile, detail);
    }

    @Transactional(readOnly = true)
    public List<RevampSupplierProfileTimelineEventDto> getTimeline(UUID profileId, User currentUser) {
        RevampSupplierRegistryProfile profile = getProfileEntity(profileId);
        validateReadAccess(profile, currentUser);
        return auditService.listEvents(ENTITY_TYPE, profileId, null).stream()
                .map(this::toTimelineDto)
                .toList();
    }

    @Transactional
    public RevampSupplierProfileDto startRenewal(UUID profileId, User currentUser) {
        RevampSupplierRegistryProfile profile = getProfileEntity(profileId);
        validateRenewalAccess(profile, currentUser);

        RegistryProfileStatus before = profile.getStatus();
        if (before != RegistryProfileStatus.APPROVED && before != RegistryProfileStatus.SUSPENDED) {
            throw new IllegalStateException("Renewal cannot be started from status: " + before);
        }

        profile.setStatus(RegistryProfileStatus.RENEWAL_DUE);
        RevampSupplierRegistryProfile saved = profileRepository.save(profile);
        appendStatusAudit(saved, before, currentUser, "revamp.profile.renewal.started", "renewal started");
        RevampSupplierRegistryProfileDetail detail = profileDetailRepository.findByProfileId(saved.getId()).orElse(null);
        return toDto(saved, detail);
    }

    @Transactional
    public RevampSupplierProfileDto suspend(UUID profileId, User currentUser) {
        RevampSupplierRegistryProfile profile = getProfileEntity(profileId);
        RegistryProfileStatus before = profile.getStatus();
        if (before == RegistryProfileStatus.SUSPENDED) {
            RevampSupplierRegistryProfileDetail detail = profileDetailRepository.findByProfileId(profile.getId()).orElse(null);
            return toDto(profile, detail);
        }
        if (before == RegistryProfileStatus.ARCHIVED) {
            throw new IllegalStateException("Archived profile cannot be suspended");
        }
        profile.setStatus(RegistryProfileStatus.SUSPENDED);
        profile.setIsVisible(false);
        RevampSupplierRegistryProfile saved = profileRepository.save(profile);
        appendStatusAudit(saved, before, currentUser, "revamp.profile.suspended", "profile suspended");
        RevampSupplierRegistryProfileDetail detail = profileDetailRepository.findByProfileId(saved.getId()).orElse(null);
        return toDto(saved, detail);
    }

    @Transactional
    public RevampSupplierProfileDto reactivate(UUID profileId, User currentUser) {
        RevampSupplierRegistryProfile profile = getProfileEntity(profileId);
        RegistryProfileStatus before = profile.getStatus();
        if (before == RegistryProfileStatus.APPROVED) {
            RevampSupplierRegistryProfileDetail detail = profileDetailRepository.findByProfileId(profile.getId()).orElse(null);
            return toDto(profile, detail);
        }
        if (before != RegistryProfileStatus.SUSPENDED && before != RegistryProfileStatus.RENEWAL_DUE) {
            throw new IllegalStateException("Profile cannot be reactivated from status: " + before);
        }
        profile.setStatus(RegistryProfileStatus.APPROVED);
        profile.setIsVisible(true);
        RevampSupplierRegistryProfile saved = profileRepository.save(profile);
        appendStatusAudit(saved, before, currentUser, "revamp.profile.reactivated", "profile reactivated");
        RevampSupplierRegistryProfileDetail detail = profileDetailRepository.findByProfileId(saved.getId()).orElse(null);
        return toDto(saved, detail);
    }

    @Transactional(readOnly = true)
    public Page<RevampSupplierProfileDto> listAdminProfiles(
            RegistryType registryType,
            RegistryProfileStatus status,
            String query,
            String ateco,
            String region,
            String serviceCategory,
            String certification,
            Pageable pageable,
            AdminRole adminRole
    ) {
        RegistryProfileStatus effectiveStatus = adminRole == AdminRole.VIEWER
                ? RegistryProfileStatus.APPROVED
                : status;
        String normalizedQuery = normalizeFilter(query);
        String normalizedAteco = normalizeFilter(ateco);
        String normalizedRegion = normalizeFilter(region);
        String normalizedServiceCategory = normalizeFilter(serviceCategory);
        String normalizedCertification = normalizeFilter(certification);

        List<RevampSupplierRegistryProfile> allProfiles = profileRepository.findAll();
        Set<UUID> allProfileIds = allProfiles.stream()
                .map(RevampSupplierRegistryProfile::getId)
                .collect(Collectors.toSet());
        Map<UUID, RevampSupplierRegistryProfileDetail> detailByProfileId = allProfileIds.isEmpty()
                ? Map.of()
                : profileDetailRepository.findByProfileIdIn(allProfileIds).stream()
                .filter(detail -> detail.getProfile() != null && detail.getProfile().getId() != null)
                .collect(Collectors.toMap(
                        detail -> detail.getProfile().getId(),
                        Function.identity(),
                        (a, b) -> b
                ));

        List<RevampSupplierRegistryProfile> filtered = allProfiles.stream()
                .filter(profile -> registryType == null || profile.getRegistryType() == registryType)
                .filter(profile -> effectiveStatus == null || profile.getStatus() == effectiveStatus)
                .filter(profile -> {
                    if (normalizedQuery == null) return true;
                    return containsIgnoreCase(profile.getDisplayName(), normalizedQuery)
                            || containsIgnoreCase(profile.getPublicSummary(), normalizedQuery)
                            || containsIgnoreCase(profile.getSupplierUser() != null ? profile.getSupplierUser().getEmail() : null, normalizedQuery);
                })
                .filter(profile -> {
                    RevampSupplierRegistryProfileDetail detail = detailByProfileId.get(profile.getId());
                    if (normalizedAteco != null && !containsIgnoreCase(detail != null ? detail.getSearchAtecoPrimary() : null, normalizedAteco)) return false;
                    if (normalizedRegion != null && !containsIgnoreCase(detail != null ? detail.getSearchRegionsCsv() : null, normalizedRegion)) return false;
                    if (normalizedServiceCategory != null && !containsIgnoreCase(detail != null ? detail.getSearchServiceCategoriesCsv() : null, normalizedServiceCategory)) return false;
                    if (normalizedCertification != null && !containsIgnoreCase(detail != null ? detail.getSearchCertificationsCsv() : null, normalizedCertification)) return false;
                    return true;
                })
                .sorted(Comparator.comparing(RevampSupplierRegistryProfile::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        int pageSize = pageable.getPageSize();
        int pageNumber = pageable.getPageNumber();
        int fromIndex = Math.min(pageNumber * pageSize, filtered.size());
        int toIndex = Math.min(fromIndex + pageSize, filtered.size());
        List<RevampSupplierRegistryProfile> content = filtered.subList(fromIndex, toIndex);
        List<RevampSupplierProfileDto> dtoContent = content.stream()
                .map(profile -> toDto(profile, detailByProfileId.get(profile.getId())))
                .toList();

        return new PageImpl<>(dtoContent, pageable, filtered.size());
    }

    @Transactional
    public void composeEmail(UUID profileId, ComposeEmailRequest request, User actor) {
        RevampSupplierRegistryProfile profile = getProfileEntity(profileId);
        if (profile.getSupplierUser() == null || profile.getSupplierUser().getEmail() == null) {
            throw new IllegalStateException("Supplier has no email address on record");
        }
        String to = profile.getSupplierUser().getEmail();

        RevampNotificationEvent event = notificationEventService.createPending(
                "admin.compose-email",
                ENTITY_TYPE,
                profileId,
                to,
                null,
                null,
                "{\"subject\":\"" + request.subject().replace("\"", "\\\"") + "\"}"
        );

        try {
            JavaMailSenderImpl sender = buildMailSender();
            String effectiveFrom = sender.getUsername() != null && !sender.getUsername().isBlank()
                    ? sender.getUsername() : "no-reply@supplierplatform.local";
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(effectiveFrom);
            message.setTo(to);
            message.setSubject(request.subject());
            message.setText(request.body());
            sender.send(message);
            notificationEventService.markSent(event.getId(), null);
        } catch (Exception ex) {
            notificationEventService.markFailed(event.getId());
            throw new IllegalStateException("Failed to send email: " + ex.getMessage(), ex);
        }
    }

    private JavaMailSenderImpl buildMailSender() {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        if (smtpConfigStore.hasConfig()) {
            sender.setHost("smtp.gmail.com");
            sender.setPort(587);
            sender.setUsername(smtpConfigStore.getEmail());
            sender.setPassword(smtpConfigStore.getPassword());
        } else {
            sender.setHost(mailHost);
            sender.setPort(mailPort);
            sender.setUsername(mailUsername != null ? mailUsername : "");
            sender.setPassword(mailPassword != null ? mailPassword : "");
        }
        java.util.Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        return sender;
    }

    private String normalizeFilter(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    private boolean containsIgnoreCase(String source, String needle) {
        if (needle == null) return true;
        if (source == null) return false;
        return source.toLowerCase().contains(needle.toLowerCase());
    }

    private RevampSupplierRegistryProfile getProfileEntity(UUID profileId) {
        return profileRepository.findById(profileId)
                .orElseThrow(() -> new EntityNotFoundException("RevampSupplierRegistryProfile", profileId));
    }

    private void validateReadAccess(RevampSupplierRegistryProfile profile, User currentUser) {
        if (currentUser == null) {
            throw new AccessDeniedException("Access denied");
        }
        if (currentUser.getRole() == UserRole.SUPPLIER &&
                (profile.getSupplierUser() == null || !currentUser.getId().equals(profile.getSupplierUser().getId()))) {
            throw new AccessDeniedException("Cannot access another supplier profile");
        }
    }

    private void validateRenewalAccess(RevampSupplierRegistryProfile profile, User currentUser) {
        validateReadAccess(profile, currentUser);
    }

    private void appendStatusAudit(
            RevampSupplierRegistryProfile profile,
            RegistryProfileStatus before,
            User actor,
            String eventKey,
            String reason
    ) {
        String actorRole = actor != null && actor.getRole() != null ? actor.getRole().name() : null;
        UUID actorUserId = actor != null ? actor.getId() : null;
        auditService.append(new RevampAuditEventInputDto(
                eventKey,
                ENTITY_TYPE,
                profile.getId(),
                actorUserId,
                actorRole,
                null,
                reason,
                "{\"status\":\"" + before.name() + "\"}",
                "{\"status\":\"" + profile.getStatus().name() + "\"}",
                "{}"
        ));
    }

    private RevampSupplierProfileDto toDto(RevampSupplierRegistryProfile profile, RevampSupplierRegistryProfileDetail detail) {
        var projected = detail != null ? detail.getProjectedJson() : null;
        var publicCardView = projected != null && projected.has("publicCardView")
                ? projected.get("publicCardView")
                : null;
        var adminCardView = projected != null && projected.has("adminCardView")
                ? projected.get("adminCardView")
                : null;
        return new RevampSupplierProfileDto(
                profile.getId(),
                profile.getApplication() != null ? profile.getApplication().getId() : null,
                profile.getSupplierUser() != null ? profile.getSupplierUser().getId() : null,
                profile.getSupplierUser() != null ? profile.getSupplierUser().getEmail() : null,
                profile.getRegistryType(),
                profile.getStatus(),
                profile.getDisplayName(),
                profile.getPublicSummary(),
                profile.getAggregateScore(),
                Boolean.TRUE.equals(profile.getIsVisible()),
                profile.getApprovedAt(),
                profile.getExpiresAt(),
                profile.getCreatedAt(),
                profile.getUpdatedAt(),
                publicCardView,
                adminCardView
        );
    }

    private RevampSupplierProfileTimelineEventDto toTimelineDto(RevampAuditEventSummaryDto event) {
        return new RevampSupplierProfileTimelineEventDto(
                event.id(),
                event.eventKey(),
                event.actorUserId(),
                event.actorRoles(),
                event.reason(),
                event.beforeStateJson(),
                event.afterStateJson(),
                event.metadataJson(),
                event.occurredAt()
        );
    }
}
