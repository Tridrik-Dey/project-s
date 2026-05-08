package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampInviteReminderRunDto;
import com.supplierplatform.revamp.enums.InviteStatus;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.repository.RevampAuditEventRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RevampInviteExpiryReminderService {

    private static final String EVENT_KEY = "revamp.invite.expiry-reminder.sent";
    private static final String EXPIRED_EVENT_KEY = "revamp.invite.expired";
    private static final String EXPIRED_ADMIN_NOTIFICATION_EVENT_KEY = "revamp.invite.expired-admin-notification.sent";
    private static final String ENTITY_TYPE = "REVAMP_INVITE";

    private final RevampInviteRepository inviteRepository;
    private final RevampAuditEventRepository auditEventRepository;
    private final RevampAuditService auditService;
    private final RevampSupplierInviteMailService mailService;

    @Value("${app.reminders.invite-expiry.enabled:true}")
    private boolean enabled;

    @Value("${app.reminders.invite-expiry.days-before:7,1}")
    private List<Integer> daysBefore;

    @Scheduled(cron = "${app.reminders.invite-expiry.cron:0 0 9 * * *}")
    public void runScheduled() {
        if (!enabled) {
            log.debug("Invite expiry reminders disabled");
            return;
        }
        RevampInviteReminderRunDto result = runNow(LocalDate.now());
        log.info(
                "Invite expiry reminder run completed scanned={} sent={} duplicate={} failed={}",
                result.scanned(),
                result.sent(),
                result.skippedDuplicate(),
                result.failed()
        );
    }

    @Transactional
    public RevampInviteReminderRunDto runNow(LocalDate today) {
        int scanned = 0;
        int sent = 0;
        int duplicate = 0;
        int failed = 0;
        ExpiryRun expiryRun = expireAndNotify(LocalDateTime.now());

        for (Integer rawDays : daysBefore) {
            if (rawDays == null || rawDays < 0) {
                continue;
            }
            int days = rawDays;
            LocalDate targetDate = today.plusDays(days);
            LocalDateTime startsAt = targetDate.atStartOfDay();
            LocalDateTime endsAt = targetDate.plusDays(1).atStartOfDay();
            List<RevampInvite> candidates = inviteRepository.findByStatusInAndExpiresAtBetween(
                    List.of(InviteStatus.SENT, InviteStatus.OPENED),
                    startsAt,
                    endsAt
            );
            scanned += candidates.size();

            String requestId = requestId(days);
            for (RevampInvite invite : candidates) {
                if (auditEventRepository.existsByEventKeyAndEntityTypeAndEntityIdAndRequestId(
                        EVENT_KEY,
                        ENTITY_TYPE,
                        invite.getId(),
                        requestId
                )) {
                    duplicate++;
                    continue;
                }

                RevampSupplierInviteMailService.InviteDispatchResult dispatch = mailService.sendExpiryReminder(invite, days);
                if (dispatch.sent()) {
                    sent++;
                    auditService.append(new RevampAuditEventInputDto(
                            EVENT_KEY,
                            ENTITY_TYPE,
                            invite.getId(),
                            null,
                            null,
                            requestId,
                            "invite expiry reminder",
                            null,
                            null,
                            "{\"daysBefore\":" + days + ",\"invitedName\":\"" + esc(invite.getInvitedName()) + "\",\"invitedEmail\":\"" + esc(invite.getInvitedEmail()) + "\"}"
                    ));
                } else {
                    failed++;
                    log.warn(
                            "Invite expiry reminder failed inviteId={} email={} daysBefore={} reason={}",
                            invite.getId(),
                            invite.getInvitedEmail(),
                            days,
                            dispatch.failureReason()
                    );
                }
            }
        }

        return new RevampInviteReminderRunDto(scanned, sent, duplicate, failed + expiryRun.failed(), expiryRun.expired(), expiryRun.notified());
    }

    private ExpiryRun expireAndNotify(LocalDateTime now) {
        List<RevampInvite> due = inviteRepository.findByStatusInAndExpiresAtBefore(
                List.of(InviteStatus.SENT, InviteStatus.OPENED),
                now
        );
        int notified = 0;
        int failed = 0;

        for (RevampInvite invite : due) {
            InviteStatus beforeStatus = invite.getStatus();
            invite.setStatus(InviteStatus.EXPIRED);
            auditService.append(new RevampAuditEventInputDto(
                    EXPIRED_EVENT_KEY,
                    ENTITY_TYPE,
                    invite.getId(),
                    null,
                    null,
                    null,
                    null,
                    "{\"status\":\"" + beforeStatus.name() + "\"}",
                    "{\"status\":\"EXPIRED\"}",
                    "{\"invitedName\":\"" + esc(invite.getInvitedName()) + "\",\"invitedEmail\":\"" + esc(invite.getInvitedEmail()) + "\"}"
            ));

            if (auditEventRepository.existsByEventKeyAndEntityTypeAndEntityIdAndRequestId(
                    EXPIRED_ADMIN_NOTIFICATION_EVENT_KEY,
                    ENTITY_TYPE,
                    invite.getId(),
                    "invite-expired-admin"
            )) {
                continue;
            }

            RevampSupplierInviteMailService.InviteDispatchResult dispatch = mailService.sendExpiredAdminNotification(invite);
            if (dispatch.sent()) {
                notified++;
                auditService.append(new RevampAuditEventInputDto(
                        EXPIRED_ADMIN_NOTIFICATION_EVENT_KEY,
                        ENTITY_TYPE,
                        invite.getId(),
                        null,
                        null,
                        "invite-expired-admin",
                        "expired invite admin notification",
                        null,
                        null,
                        "{\"invitedName\":\"" + esc(invite.getInvitedName()) + "\",\"invitedEmail\":\"" + esc(invite.getInvitedEmail()) + "\"}"
                ));
            } else {
                failed++;
                log.warn(
                        "Expired invite admin notification failed inviteId={} email={} reason={}",
                        invite.getId(),
                        invite.getInvitedEmail(),
                        dispatch.failureReason()
                );
            }
        }
        inviteRepository.saveAll(due);
        return new ExpiryRun(due.size(), notified, failed);
    }

    private static String requestId(int days) {
        return "invite-reminder-" + days + "d";
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private record ExpiryRun(int expired, int notified, int failed) {}
}
