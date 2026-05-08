package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampInviteListRowDto;
import com.supplierplatform.revamp.dto.RevampInviteMonitorDto;
import com.supplierplatform.revamp.enums.InviteStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RevampInviteService {

    private final RevampInviteRepository inviteRepository;
    private final RevampApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final RevampAuditService auditService;

    private static final java.util.Set<InviteStatus> ACTIVE_STATUSES = java.util.Set.of(
            InviteStatus.CREATED, InviteStatus.SENT, InviteStatus.OPENED
    );

    @Transactional
    public RevampInvite createInvite(
            RegistryType registryType,
            String invitedEmail,
            String invitedName,
            UUID sourceUserId,
            LocalDateTime expiresAt,
            String note
    ) {
        LocalDateTime now = LocalDateTime.now();
        List<RevampInvite> existing = inviteRepository.findByInvitedEmailIgnoreCase(invitedEmail);

        boolean consumed = existing.stream().anyMatch(i -> i.getStatus() == InviteStatus.CONSUMED);
        if (consumed) {
            throw new IllegalStateException(
                    "This email already has an active supplier account. No new invite needed."
            );
        }

        boolean activeExists = existing.stream()
                .anyMatch(i -> ACTIVE_STATUSES.contains(i.getStatus())
                        && (i.getExpiresAt() == null || i.getExpiresAt().isAfter(now)));
        if (activeExists) {
            throw new IllegalStateException(
                    "An active invite already exists for " + invitedEmail + ". Cancel or wait for it to expire before sending a new one."
            );
        }

        RevampInvite invite = new RevampInvite();
        invite.setRegistryType(registryType);
        invite.setInvitedEmail(invitedEmail);
        invite.setInvitedName(invitedName);
        invite.setToken(UUID.randomUUID().toString().replace("-", ""));
        invite.setStatus(InviteStatus.CREATED);
        invite.setExpiresAt(expiresAt);
        invite.setNote(note);

        User source = null;
        if (sourceUserId != null) {
            source = userRepository.findById(sourceUserId)
                    .orElseThrow(() -> new EntityNotFoundException("User", sourceUserId));
            invite.setSourceUser(source);
        }

        RevampInvite saved = inviteRepository.save(invite);
        auditService.append(new RevampAuditEventInputDto(
                "revamp.invite.created",
                "REVAMP_INVITE",
                saved.getId(),
                sourceUserId,
                source != null ? source.getRole().name() : null,
                null,
                null,
                "{\"status\":null}",
                "{\"status\":\"" + saved.getStatus().name() + "\"}",
                "{\"invitedName\":\"" + esc(saved.getInvitedName()) + "\",\"invitedEmail\":\"" + esc(saved.getInvitedEmail()) + "\"}"
        ));
        return saved;
    }

    @Transactional(readOnly = true)
    public RevampInvite getByToken(String token) {
        return inviteRepository.findByToken(token)
                .orElseThrow(() -> new EntityNotFoundException("RevampInvite token not found: " + token));
    }

    @Transactional
    public RevampInvite markOpened(String token) {
        RevampInvite invite = getByToken(token);
        if (invite.getStatus() == InviteStatus.CREATED || invite.getStatus() == InviteStatus.SENT) {
            InviteStatus beforeStatus = invite.getStatus();
            invite.setStatus(InviteStatus.OPENED);
            RevampInvite saved = inviteRepository.save(invite);
            auditService.append(new RevampAuditEventInputDto(
                    "revamp.invite.opened",
                    "REVAMP_INVITE",
                    saved.getId(),
                    null,
                    null,
                    null,
                    null,
                    "{\"status\":\"" + beforeStatus.name() + "\"}",
                    "{\"status\":\"" + saved.getStatus().name() + "\"}",
                    "{\"invitedName\":\"" + esc(saved.getInvitedName()) + "\",\"invitedEmail\":\"" + esc(saved.getInvitedEmail()) + "\"}"
            ));
            return saved;
        }
        return invite;
    }

    @Transactional
    public RevampInvite markSent(UUID inviteId, UUID sourceUserId) {
        RevampInvite invite = inviteRepository.findById(inviteId)
                .orElseThrow(() -> new EntityNotFoundException("RevampInvite", inviteId));
        InviteStatus beforeStatus = invite.getStatus();
        if (beforeStatus == InviteStatus.CREATED || beforeStatus == InviteStatus.OPENED || beforeStatus == InviteStatus.SENT) {
            invite.setStatus(InviteStatus.SENT);
            RevampInvite saved = inviteRepository.save(invite);
            auditService.append(new RevampAuditEventInputDto(
                    "revamp.invite.sent",
                    "REVAMP_INVITE",
                    saved.getId(),
                    sourceUserId,
                    null,
                    null,
                    null,
                    "{\"status\":\"" + beforeStatus.name() + "\"}",
                    "{\"status\":\"" + saved.getStatus().name() + "\"}",
                    "{\"invitedName\":\"" + esc(saved.getInvitedName()) + "\",\"invitedEmail\":\"" + esc(saved.getInvitedEmail()) + "\"}"
            ));
            return saved;
        }
        return invite;
    }

    @Transactional
    public RevampInvite updateInvite(
            UUID inviteId,
            RegistryType registryType,
            String invitedEmail,
            String invitedName,
            UUID sourceUserId,
            LocalDateTime expiresAt,
            String note
    ) {
        RevampInvite invite = inviteRepository.findById(inviteId)
                .orElseThrow(() -> new EntityNotFoundException("RevampInvite", inviteId));
        if (invite.getStatus() == InviteStatus.CONSUMED
                || invite.getStatus() == InviteStatus.EXPIRED
                || invite.getStatus() == InviteStatus.RENEWED
                || invite.getStatus() == InviteStatus.CANCELLED) {
            throw new IllegalStateException("Invite cannot be updated after it is expired, consumed or closed");
        }

        String before = "{\"status\":\"" + invite.getStatus().name() + "\",\"invitedName\":\"" + esc(invite.getInvitedName()) + "\",\"invitedEmail\":\"" + esc(invite.getInvitedEmail()) + "\"}";
        invite.setRegistryType(registryType);
        invite.setInvitedEmail(invitedEmail);
        invite.setInvitedName(invitedName);
        invite.setExpiresAt(expiresAt);
        invite.setNote(note);
        RevampInvite saved = inviteRepository.save(invite);

        auditService.append(new RevampAuditEventInputDto(
                "revamp.invite.updated",
                "REVAMP_INVITE",
                saved.getId(),
                sourceUserId,
                null,
                null,
                null,
                before,
                "{\"status\":\"" + saved.getStatus().name() + "\",\"invitedName\":\"" + esc(saved.getInvitedName()) + "\",\"invitedEmail\":\"" + esc(saved.getInvitedEmail()) + "\"}",
                "{\"reason\":\"admin invite details updated\"}"
        ));
        return saved;
    }

    @Transactional
    public RevampInvite markConsumed(UUID inviteId) {
        RevampInvite invite = inviteRepository.findById(inviteId)
                .orElseThrow(() -> new EntityNotFoundException("RevampInvite", inviteId));
        InviteStatus beforeStatus = invite.getStatus();
        invite.setStatus(InviteStatus.CONSUMED);
        invite.setConsumedAt(LocalDateTime.now());
        RevampInvite saved = inviteRepository.save(invite);
        auditService.append(new RevampAuditEventInputDto(
                "revamp.invite.consumed",
                "REVAMP_INVITE",
                saved.getId(),
                null,
                null,
                null,
                null,
                "{\"status\":\"" + beforeStatus.name() + "\"}",
                "{\"status\":\"" + saved.getStatus().name() + "\"}",
                "{\"invitedName\":\"" + esc(saved.getInvitedName()) + "\",\"invitedEmail\":\"" + esc(saved.getInvitedEmail()) + "\"}"
        ));
        return saved;
    }

    @Transactional
    public int expireInvitesDue(LocalDateTime now) {
        List<RevampInvite> due = inviteRepository.findByStatusInAndExpiresAtBefore(List.of(InviteStatus.SENT, InviteStatus.OPENED), now);
        for (RevampInvite invite : due) {
            InviteStatus beforeStatus = invite.getStatus();
            invite.setStatus(InviteStatus.EXPIRED);
            auditService.append(new RevampAuditEventInputDto(
                    "revamp.invite.expired",
                    "REVAMP_INVITE",
                    invite.getId(),
                    null,
                    null,
                    null,
                    null,
                    "{\"status\":\"" + beforeStatus.name() + "\"}",
                    "{\"status\":\"EXPIRED\"}",
                    "{\"invitedName\":\"" + esc(invite.getInvitedName()) + "\",\"invitedEmail\":\"" + esc(invite.getInvitedEmail()) + "\"}"
            ));
        }
        inviteRepository.saveAll(due);
        return due.size();
    }

    @Transactional(readOnly = true)
    public RevampInviteMonitorDto monitorInvites() {
        List<RevampInviteListRowDto> rows = inviteRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toMonitorRowSafely)
                .toList();
        long completed = rows.stream().filter(row -> "COMPLETATO".equals(row.uiStatus())).count();
        long pending = rows.stream().filter(row -> "IN_ATTESA".equals(row.uiStatus()) || "IN_COMPILAZIONE".equals(row.uiStatus())).count();
        long expired = rows.stream().filter(row -> "SCADUTO".equals(row.uiStatus())).count();
        return new RevampInviteMonitorDto(rows.size(), completed, pending, expired, rows);
    }

    @Transactional
    public RevampInvite renewInvite(UUID inviteId, UUID sourceUserId, int expiresInDays) {
        RevampInvite original = inviteRepository.findById(inviteId)
                .orElseThrow(() -> new EntityNotFoundException("RevampInvite", inviteId));
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(Math.max(1, expiresInDays));

        RevampInvite renewed = new RevampInvite();
        renewed.setRegistryType(original.getRegistryType());
        renewed.setInvitedEmail(original.getInvitedEmail());
        renewed.setInvitedName(original.getInvitedName());
        renewed.setToken(UUID.randomUUID().toString().replace("-", ""));
        renewed.setStatus(InviteStatus.CREATED);
        renewed.setExpiresAt(expiresAt);
        renewed.setRenewedFromInvite(original);
        renewed.setNote(original.getNote());

        User source = null;
        if (sourceUserId != null) {
            source = userRepository.findById(sourceUserId)
                    .orElseThrow(() -> new EntityNotFoundException("User", sourceUserId));
            renewed.setSourceUser(source);
        }

        InviteStatus beforeStatus = original.getStatus();
        original.setStatus(InviteStatus.RENEWED);
        inviteRepository.save(original);
        RevampInvite saved = inviteRepository.save(renewed);

        auditService.append(new RevampAuditEventInputDto(
                "revamp.invite.renewed",
                "REVAMP_INVITE",
                original.getId(),
                sourceUserId,
                source != null ? source.getRole().name() : null,
                null,
                null,
                "{\"status\":\"" + beforeStatus.name() + "\"}",
                "{\"status\":\"RENEWED\"}",
                "{\"newInviteId\":\"" + saved.getId() + "\",\"invitedName\":\"" + esc(original.getInvitedName()) + "\",\"invitedEmail\":\"" + esc(original.getInvitedEmail()) + "\"}"
        ));
        return saved;
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private RevampInviteListRowDto toMonitorRowSafely(RevampInvite invite) {
        try {
            return toMonitorRow(invite);
        } catch (Exception ex) {
            log.warn("Skipping unsafe invite mapping for inviteId={}: {}", invite != null ? invite.getId() : null, ex.getMessage());
            return fallbackMonitorRow(invite);
        }
    }

    private RevampInviteListRowDto toMonitorRow(RevampInvite invite) {
        RevampApplication linkedApplication = applicationRepository
                .findFirstByInviteIdOrderByUpdatedAtDesc(invite.getId())
                .orElse(null);
        String uiStatus = resolveUiStatus(invite, linkedApplication);
        int progress = resolveProgress(uiStatus);
        boolean canRenew = uiStatus.equals("SCADUTO") || uiStatus.equals("RIFIUTATO");
        boolean canOpenProfile = linkedApplication != null;
        String invitedByName = resolveInvitedByName(invite);
        String profilePath = linkedApplication != null ? "/admin/candidature/" + linkedApplication.getId() + "/review" : null;

        return new RevampInviteListRowDto(
                invite.getId(),
                invite.getInvitedName(),
                invite.getInvitedEmail(),
                safeRegistryType(invite),
                safeInviteStatus(invite),
                uiStatus,
                progress,
                invite.getCreatedAt(),
                invite.getExpiresAt(),
                invitedByName,
                invite.getNote(),
                linkedApplication != null ? linkedApplication.getId() : null,
                profilePath,
                canRenew,
                canOpenProfile
        );
    }

    private RevampInviteListRowDto fallbackMonitorRow(RevampInvite invite) {
        String uiStatus = resolveUiStatus(invite, null);
        return new RevampInviteListRowDto(
                invite != null ? invite.getId() : null,
                invite != null ? invite.getInvitedName() : null,
                invite != null ? invite.getInvitedEmail() : null,
                invite != null ? safeRegistryType(invite) : "ALBO_A",
                invite != null ? safeInviteStatus(invite) : "CREATED",
                uiStatus,
                resolveProgress(uiStatus),
                invite != null ? invite.getCreatedAt() : null,
                invite != null ? invite.getExpiresAt() : null,
                "n/d",
                invite != null ? invite.getNote() : null,
                null,
                null,
                false,
                false
        );
    }

    private String resolveInvitedByName(RevampInvite invite) {
        try {
            if (invite == null || invite.getSourceUser() == null) {
                return "n/d";
            }
            String value = invite.getSourceUser().getEmail();
            return value != null && !value.isBlank() ? value : "n/d";
        } catch (Exception ex) {
            log.warn("Unable to resolve source user for inviteId={}: {}", invite != null ? invite.getId() : null, ex.getMessage());
            return "n/d";
        }
    }

    private String safeRegistryType(RevampInvite invite) {
        if (invite == null || invite.getRegistryType() == null) {
            return "ALBO_A";
        }
        return invite.getRegistryType().name();
    }

    private String safeInviteStatus(RevampInvite invite) {
        if (invite == null || invite.getStatus() == null) {
            return "CREATED";
        }
        return invite.getStatus().name();
    }

    private String resolveUiStatus(RevampInvite invite, RevampApplication application) {
        if (application != null && application.getStatus() != null) {
            String appStatus = application.getStatus().name();
            if ("APPROVED".equals(appStatus)) return "COMPLETATO";
            if ("REJECTED".equals(appStatus)) return "RIFIUTATO";
            if ("DRAFT".equals(appStatus) || "INTEGRATION_REQUIRED".equals(appStatus)) return "IN_COMPILAZIONE";
            if ("SUBMITTED".equals(appStatus) || "UNDER_REVIEW".equals(appStatus)) return "IN_ATTESA";
        }
        InviteStatus inviteStatus = invite != null ? invite.getStatus() : null;
        if (inviteStatus == InviteStatus.EXPIRED) return "SCADUTO";
        if (inviteStatus == InviteStatus.CONSUMED) return "COMPLETATO";
        if (inviteStatus == InviteStatus.OPENED) return "IN_COMPILAZIONE";
        return "IN_ATTESA";
    }

    private int resolveProgress(String uiStatus) {
        return switch (uiStatus) {
            case "COMPLETATO" -> 100;
            case "IN_COMPILAZIONE" -> 55;
            case "IN_ATTESA" -> 0;
            case "SCADUTO" -> 0;
            case "RIFIUTATO" -> 0;
            default -> 0;
        };
    }
}
