package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.model.RevampUserAdminRole;
import com.supplierplatform.revamp.repository.RevampUserAdminRoleRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevampAdminRoleServiceTest {

    @Mock
    private RevampUserAdminRoleRepository userAdminRoleRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RevampAuditService auditService;

    @InjectMocks
    private RevampAdminRoleService adminRoleService;

    @Test
    void assignBlocksSelfDemotionFromSuperAdmin() {
        UUID actorId = UUID.randomUUID();
        User actor = adminUser(actorId);
        RevampUserAdminRole superAdminAssignment = assignment(actor, AdminRole.SUPER_ADMIN);

        when(userRepository.findById(actorId)).thenReturn(Optional.of(actor));
        when(userAdminRoleRepository.findByUserId(actorId)).thenReturn(List.of(superAdminAssignment));

        assertThrows(
                AccessDeniedException.class,
                () -> adminRoleService.assign(actorId, AdminRole.VIEWER, actorId)
        );

        verify(userAdminRoleRepository, never()).deleteByUserId(any(UUID.class));
        verify(userAdminRoleRepository, never()).save(any(RevampUserAdminRole.class));
    }

    @Test
    void revokeBlocksOwnSuperAdminRole() {
        UUID actorId = UUID.randomUUID();

        assertThrows(
                AccessDeniedException.class,
                () -> adminRoleService.revoke(actorId, AdminRole.SUPER_ADMIN, actorId)
        );

        verify(userAdminRoleRepository, never()).deleteByUserIdAndAdminRole(any(UUID.class), any(AdminRole.class));
    }

    @Test
    void revokeBlocksRemovingLastActiveSuperAdminFromAnotherUser() {
        UUID actorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();

        when(userAdminRoleRepository.countActiveByAdminRole(AdminRole.SUPER_ADMIN)).thenReturn(1L);

        assertThrows(
                AccessDeniedException.class,
                () -> adminRoleService.revoke(targetId, AdminRole.SUPER_ADMIN, actorId)
        );

        verify(userAdminRoleRepository, never()).deleteByUserIdAndAdminRole(any(UUID.class), any(AdminRole.class));
    }

    @Test
    void deactivateBlocksCurrentSuperAdminTarget() {
        UUID actorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User actor = adminUser(actorId);
        User target = adminUser(targetId);

        when(userRepository.findById(actorId)).thenReturn(Optional.of(actor));
        when(userAdminRoleRepository.existsByUserIdAndAdminRole(actorId, AdminRole.SUPER_ADMIN)).thenReturn(true);
        when(userRepository.findById(targetId)).thenReturn(Optional.of(target));
        when(userAdminRoleRepository.findByUserId(targetId)).thenReturn(List.of(assignment(target, AdminRole.SUPER_ADMIN)));

        assertThrows(
                AccessDeniedException.class,
                () -> adminRoleService.deactivateAdminUser(targetId, actorId)
        );

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void deactivateBlocksSelf() {
        UUID actorId = UUID.randomUUID();
        User actor = adminUser(actorId);

        when(userRepository.findById(actorId)).thenReturn(Optional.of(actor));
        when(userAdminRoleRepository.existsByUserIdAndAdminRole(actorId, AdminRole.SUPER_ADMIN)).thenReturn(true);

        assertThrows(
                AccessDeniedException.class,
                () -> adminRoleService.deactivateAdminUser(actorId, actorId)
        );

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void archiveAllowsDemotedFormerSuperAdmin() {
        UUID actorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        User actor = adminUser(actorId);
        User target = adminUser(targetId);

        when(userRepository.findById(actorId)).thenReturn(Optional.of(actor));
        when(userAdminRoleRepository.existsByUserIdAndAdminRole(actorId, AdminRole.SUPER_ADMIN)).thenReturn(true);
        when(userRepository.findById(targetId)).thenReturn(Optional.of(target));
        when(userAdminRoleRepository.findByUserId(targetId)).thenReturn(List.of(assignment(target, AdminRole.VIEWER)));
        when(userRepository.save(eq(target))).thenReturn(target);

        adminRoleService.archiveAdminUser(targetId, actorId);

        verify(userRepository).save(target);
        verify(auditService).append(any());
    }

    private static User adminUser(UUID id) {
        User user = new User();
        user.setId(id);
        user.setEmail(id + "@test.local");
        user.setPasswordHash("hash");
        user.setRole(UserRole.ADMIN);
        user.setIsActive(true);
        return user;
    }

    private static RevampUserAdminRole assignment(User user, AdminRole role) {
        RevampUserAdminRole assignment = new RevampUserAdminRole();
        assignment.setId(UUID.randomUUID());
        assignment.setUser(user);
        assignment.setAdminRole(role);
        return assignment;
    }
}
