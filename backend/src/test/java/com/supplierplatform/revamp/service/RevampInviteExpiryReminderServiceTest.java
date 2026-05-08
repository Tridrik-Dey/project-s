package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.dto.RevampInviteReminderRunDto;
import com.supplierplatform.revamp.enums.InviteStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.repository.RevampAuditEventRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevampInviteExpiryReminderServiceTest {

    @Mock
    private RevampInviteRepository inviteRepository;

    @Mock
    private RevampAuditEventRepository auditEventRepository;

    @Mock
    private RevampAuditService auditService;

    @Mock
    private RevampSupplierInviteMailService mailService;

    @Test
    void runNowSendsReminderOnceForMatchingInvite() {
        RevampInvite invite = invite("supplier@test.com", LocalDateTime.of(2026, 5, 1, 9, 0));
        RevampInviteExpiryReminderService service = service(List.of(7, 1));
        LocalDate today = LocalDate.of(2026, 4, 24);

        when(inviteRepository.findByStatusInAndExpiresAtBefore(any(), any())).thenReturn(List.of());
        when(inviteRepository.findByStatusInAndExpiresAtBetween(
                eq(List.of(InviteStatus.SENT, InviteStatus.OPENED)),
                eq(LocalDateTime.of(2026, 5, 1, 0, 0)),
                eq(LocalDateTime.of(2026, 5, 2, 0, 0))
        )).thenReturn(List.of(invite));
        when(inviteRepository.findByStatusInAndExpiresAtBetween(
                eq(List.of(InviteStatus.SENT, InviteStatus.OPENED)),
                eq(LocalDateTime.of(2026, 4, 25, 0, 0)),
                eq(LocalDateTime.of(2026, 4, 26, 0, 0))
        )).thenReturn(List.of());
        when(auditEventRepository.existsByEventKeyAndEntityTypeAndEntityIdAndRequestId(
                eq("revamp.invite.expiry-reminder.sent"),
                eq("REVAMP_INVITE"),
                eq(invite.getId()),
                eq("invite-reminder-7d")
        )).thenReturn(false);
        when(mailService.sendExpiryReminder(invite, 7))
                .thenReturn(new RevampSupplierInviteMailService.InviteDispatchResult(true, "http://test/invite/token", null));

        RevampInviteReminderRunDto result = service.runNow(today);

        assertThat(result.scanned()).isEqualTo(1);
        assertThat(result.sent()).isEqualTo(1);
        assertThat(result.skippedDuplicate()).isZero();
        assertThat(result.failed()).isZero();
        verify(mailService).sendExpiryReminder(invite, 7);
        verify(auditService).append(any());
    }

    @Test
    void runNowSkipsDuplicateReminder() {
        RevampInvite invite = invite("supplier@test.com", LocalDateTime.of(2026, 5, 1, 9, 0));
        RevampInviteExpiryReminderService service = service(List.of(7));

        when(inviteRepository.findByStatusInAndExpiresAtBefore(any(), any())).thenReturn(List.of());
        when(inviteRepository.findByStatusInAndExpiresAtBetween(any(), any(), any())).thenReturn(List.of(invite));
        when(auditEventRepository.existsByEventKeyAndEntityTypeAndEntityIdAndRequestId(any(), any(), eq(invite.getId()), eq("invite-reminder-7d")))
                .thenReturn(true);

        RevampInviteReminderRunDto result = service.runNow(LocalDate.of(2026, 4, 24));

        assertThat(result.scanned()).isEqualTo(1);
        assertThat(result.sent()).isZero();
        assertThat(result.skippedDuplicate()).isEqualTo(1);
        verify(mailService, never()).sendExpiryReminder(any(), eq(7L));
        verify(auditService, never()).append(any());
    }

    @Test
    void runNowCountsFailedSendWithoutAudit() {
        RevampInvite invite = invite("supplier@test.com", LocalDateTime.of(2026, 4, 25, 9, 0));
        RevampInviteExpiryReminderService service = service(List.of(1));

        when(inviteRepository.findByStatusInAndExpiresAtBefore(any(), any())).thenReturn(List.of());
        when(inviteRepository.findByStatusInAndExpiresAtBetween(any(), any(), any())).thenReturn(List.of(invite));
        when(auditEventRepository.existsByEventKeyAndEntityTypeAndEntityIdAndRequestId(any(), any(), eq(invite.getId()), eq("invite-reminder-1d")))
                .thenReturn(false);
        when(mailService.sendExpiryReminder(invite, 1))
                .thenReturn(new RevampSupplierInviteMailService.InviteDispatchResult(false, "http://test/invite/token", "MailException"));

        RevampInviteReminderRunDto result = service.runNow(LocalDate.of(2026, 4, 24));

        assertThat(result.scanned()).isEqualTo(1);
        assertThat(result.sent()).isZero();
        assertThat(result.failed()).isEqualTo(1);
        verify(auditService, never()).append(any());
    }

    @Test
    void runNowExpiresDueInviteAndNotifiesAdmin() {
        RevampInvite invite = invite("supplier@test.com", LocalDateTime.now().minusHours(1));
        invite.setSourceUser(adminUser());
        RevampInviteExpiryReminderService service = service(List.of(7));

        when(inviteRepository.findByStatusInAndExpiresAtBefore(any(), any())).thenReturn(List.of(invite));
        when(inviteRepository.findByStatusInAndExpiresAtBetween(any(), any(), any())).thenReturn(List.of());
        when(auditEventRepository.existsByEventKeyAndEntityTypeAndEntityIdAndRequestId(
                eq("revamp.invite.expired-admin-notification.sent"),
                eq("REVAMP_INVITE"),
                eq(invite.getId()),
                eq("invite-expired-admin")
        )).thenReturn(false);
        when(mailService.sendExpiredAdminNotification(invite))
                .thenReturn(new RevampSupplierInviteMailService.InviteDispatchResult(true, "http://test/invite/token", null));

        RevampInviteReminderRunDto result = service.runNow(LocalDate.now());

        assertThat(invite.getStatus()).isEqualTo(InviteStatus.EXPIRED);
        assertThat(result.expired()).isEqualTo(1);
        assertThat(result.expiryNotified()).isEqualTo(1);
        verify(inviteRepository).saveAll(List.of(invite));
        verify(mailService).sendExpiredAdminNotification(invite);
    }

    private RevampInviteExpiryReminderService service(List<Integer> daysBefore) {
        RevampInviteExpiryReminderService service = new RevampInviteExpiryReminderService(
                inviteRepository,
                auditEventRepository,
                auditService,
                mailService
        );
        ReflectionTestUtils.setField(service, "daysBefore", daysBefore);
        ReflectionTestUtils.setField(service, "enabled", true);
        return service;
    }

    private static RevampInvite invite(String email, LocalDateTime expiresAt) {
        RevampInvite invite = new RevampInvite();
        invite.setId(UUID.randomUUID());
        invite.setRegistryType(RegistryType.ALBO_A);
        invite.setStatus(InviteStatus.SENT);
        invite.setInvitedEmail(email);
        invite.setInvitedName("Supplier Test");
        invite.setToken("token");
        invite.setExpiresAt(expiresAt);
        return invite;
    }

    private static User adminUser() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("admin@test.com");
        user.setRole(UserRole.ADMIN);
        user.setPasswordHash("hash");
        user.setIsActive(true);
        return user;
    }
}
