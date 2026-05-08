package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.enums.InviteStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevampInviteServiceTest {

    @Mock
    private RevampInviteRepository inviteRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RevampAuditService auditService;

    @InjectMocks
    private RevampInviteService inviteService;

    @Test
    void createInviteStoresInviteAndAppendsAudit() {
        UUID sourceUserId = UUID.randomUUID();
        User source = new User();
        source.setId(sourceUserId);
        source.setRole(UserRole.ADMIN);

        when(userRepository.findById(sourceUserId)).thenReturn(Optional.of(source));
        when(inviteRepository.save(any(RevampInvite.class))).thenAnswer(invocation -> {
            RevampInvite saved = invocation.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });

        RevampInvite invite = inviteService.createInvite(
                RegistryType.ALBO_A,
                "invite@test.com",
                "Invite Test",
                sourceUserId,
                LocalDateTime.now().plusDays(15),
                "note"
        );

        assertNotNull(invite.getId());
        assertEquals(InviteStatus.CREATED, invite.getStatus());
        verify(auditService).append(any(RevampAuditEventInputDto.class));
    }

    @Test
    void markOpenedAndConsumedEmitAudit() {
        UUID inviteId = UUID.randomUUID();
        RevampInvite invite = new RevampInvite();
        invite.setId(inviteId);
        invite.setToken("token123");
        invite.setStatus(InviteStatus.CREATED);

        when(inviteRepository.findByToken("token123")).thenReturn(Optional.of(invite));
        when(inviteRepository.findById(inviteId)).thenReturn(Optional.of(invite));
        when(inviteRepository.save(any(RevampInvite.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampInvite opened = inviteService.markOpened("token123");
        assertEquals(InviteStatus.OPENED, opened.getStatus());

        RevampInvite consumed = inviteService.markConsumed(inviteId);
        assertEquals(InviteStatus.CONSUMED, consumed.getStatus());
        assertNotNull(consumed.getConsumedAt());

        verify(auditService, org.mockito.Mockito.times(2)).append(any(RevampAuditEventInputDto.class));
    }

    @Test
    void expireInvitesDueChangesStatusAndEmitsAudit() {
        RevampInvite due = new RevampInvite();
        due.setId(UUID.randomUUID());
        due.setStatus(InviteStatus.SENT);

        when(inviteRepository.findByStatusInAndExpiresAtBefore(anyList(), any(LocalDateTime.class)))
                .thenReturn(List.of(due));
        when(inviteRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        int expired = inviteService.expireInvitesDue(LocalDateTime.now());

        assertEquals(1, expired);
        assertEquals(InviteStatus.EXPIRED, due.getStatus());
        verify(auditService).append(any(RevampAuditEventInputDto.class));
    }
}

