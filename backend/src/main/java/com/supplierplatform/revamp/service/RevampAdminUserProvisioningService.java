package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.AdminUserInviteDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserService;
import com.supplierplatform.user.UserRole;
import com.supplierplatform.validation.EmailValidators;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampAdminUserProvisioningService {

    private final UserRepository userRepository;
    private final UserService userService;
    private final RevampAdminRoleService adminRoleService;
    private final RevampAdminInviteMailService inviteMailService;

    @Transactional
    public AdminUserInviteDto inviteAdminUser(
            String email,
            AdminRole adminRole,
            int expiresInDays,
            UUID actorUserId
    ) {
        adminRoleService.requireSuperAdmin(actorUserId);
        String normalizedEmail = EmailValidators.normalize(email).toLowerCase();
        if (!EmailValidators.hasValidDomainSuffix(normalizedEmail)) {
            throw new IllegalArgumentException("Email must include a valid domain suffix (e.g. .com, .it)");
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalStateException("Email is already in use: " + normalizedEmail);
        }

        LocalDateTime expiresAt = LocalDateTime.now().plusDays(Math.max(1, Math.min(expiresInDays, 30)));
        User invited = userService.createInvitedUser(normalizedEmail, actorUserId, expiresAt);
        adminRoleService.assign(invited.getId(), adminRole, actorUserId);

        String inviteToken = userRepository.findById(invited.getId())
                .map(User::getInviteToken)
                .orElseThrow(() -> new EntityNotFoundException("User", invited.getId()));
        AdminUserInviteDto draft = new AdminUserInviteDto(
                invited.getId(),
                invited.getEmail(),
                adminRole,
                invited.getInviteExpiresAt()
        );
        RevampAdminInviteMailService.InviteDispatchResult dispatch = inviteMailService.sendInvite(draft, inviteToken);
        return new AdminUserInviteDto(
                invited.getId(),
                invited.getEmail(),
                adminRole,
                invited.getInviteExpiresAt(),
                dispatch.sent(),
                dispatch.activationUrl()
        );
    }

    @Transactional
    public AdminUserInviteDto resendAdminUserInvite(UUID targetUserId, int expiresInDays, UUID actorUserId) {
        adminRoleService.requireSuperAdmin(actorUserId);
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", targetUserId));
        if (target.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Only ADMIN users can receive admin invites");
        }
        if (target.getDeletedAt() != null) {
            throw new IllegalStateException("Archived admin users cannot receive a new invite");
        }
        if (Boolean.TRUE.equals(target.getIsActive()) || target.getInviteToken() == null) {
            throw new IllegalStateException("Only pending admin invites can be resent");
        }

        AdminRole adminRole = adminRoleService.listByUser(targetUserId).stream()
                .findFirst()
                .map(role -> role.getAdminRole())
                .orElseThrow(() -> new IllegalStateException("Pending admin invite has no governance role"));

        target.setInviteToken(UUID.randomUUID().toString());
        target.setInviteExpiresAt(LocalDateTime.now().plusDays(Math.max(1, Math.min(expiresInDays, 30))));
        User saved = userRepository.save(target);

        AdminUserInviteDto draft = new AdminUserInviteDto(
                saved.getId(),
                saved.getEmail(),
                adminRole,
                saved.getInviteExpiresAt()
        );
        RevampAdminInviteMailService.InviteDispatchResult dispatch = inviteMailService.sendInvite(draft, saved.getInviteToken());
        return new AdminUserInviteDto(
                saved.getId(),
                saved.getEmail(),
                adminRole,
                saved.getInviteExpiresAt(),
                dispatch.sent(),
                dispatch.activationUrl()
        );
    }
}
