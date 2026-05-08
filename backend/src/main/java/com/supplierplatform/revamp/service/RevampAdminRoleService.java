package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.AdminAccountStatus;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.model.RevampUserAdminRole;
import com.supplierplatform.revamp.repository.RevampUserAdminRoleRepository;
import com.supplierplatform.revamp.dto.RevampAdminUserRoleDto;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampAdminRoleService {
    private final RevampUserAdminRoleRepository userAdminRoleRepository;
    private final UserRepository userRepository;
    private final RevampAuditService auditService;

    @Transactional(readOnly = true)
    public void requireSuperAdmin(UUID actorUserId) {
        if (actorUserId == null) {
            throw new AccessDeniedException("Only SUPER_ADMIN can perform this action");
        }
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", actorUserId));
        if (actor.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Only SUPER_ADMIN can perform this action");
        }
        if (!userAdminRoleRepository.existsByUserIdAndAdminRole(actorUserId, AdminRole.SUPER_ADMIN)) {
            throw new AccessDeniedException("Only SUPER_ADMIN can perform this action");
        }
    }

    @Transactional
    public RevampUserAdminRole assign(UUID targetUserId, AdminRole role, UUID actorUserId) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", targetUserId));
        if (target.getDeletedAt() != null) {
            throw new IllegalStateException("Archived admin users cannot be assigned roles");
        }

        List<RevampUserAdminRole> existingAssignments = userAdminRoleRepository.findByUserId(targetUserId);
        if (existingAssignments.size() == 1 && existingAssignments.get(0).getAdminRole() == role) {
            throw new IllegalStateException("Admin role already assigned");
        }
        if (!existingAssignments.isEmpty() && existingAssignments.get(0).getAdminRole() == AdminRole.SUPER_ADMIN && role != AdminRole.SUPER_ADMIN) {
            enforceSuperAdminRemovalAllowed(targetUserId, actorUserId);
        }

        if (target.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Governance roles can be assigned only to ADMIN users");
        }
        User actor = actorUserId == null ? null : userRepository.findById(actorUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", actorUserId));

        String previousRoleJson = existingAssignments.isEmpty()
                ? "{\"role\":null}"
                : "{\"role\":\"" + existingAssignments.get(0).getAdminRole().name() + "\"}";
        if (!existingAssignments.isEmpty()) {
            userAdminRoleRepository.deleteByUserId(targetUserId);
        }

        RevampUserAdminRole assignment = new RevampUserAdminRole();
        assignment.setUser(target);
        assignment.setAdminRole(role);
        assignment.setCreatedByUser(actor);
        RevampUserAdminRole saved = userAdminRoleRepository.save(assignment);

        auditService.append(new RevampAuditEventInputDto(
                "revamp.admin-role.assigned",
                "REVAMP_USER_ADMIN_ROLE",
                targetUserId,
                actorUserId,
                actor != null && actor.getRole() != null ? actor.getRole().name() : null,
                null,
                "assign admin role",
                previousRoleJson,
                "{\"role\":\"" + role.name() + "\"}",
                "{\"assignmentId\":\"" + saved.getId() + "\",\"targetUserName\":\"" + esc(target.getEmail()) + "\",\"role\":\"" + role.name() + "\"}"
        ));
        return saved;
    }

    @Transactional(readOnly = true)
    public List<RevampUserAdminRole> listByUser(UUID userId) {
        return userAdminRoleRepository.findByUserId(userId);
    }

    @Transactional
    public void revoke(UUID targetUserId, AdminRole role, UUID actorUserId) {
        if (role == AdminRole.SUPER_ADMIN) {
            enforceSuperAdminRemovalAllowed(targetUserId, actorUserId);
        }

        User target = userRepository.findById(targetUserId).orElse(null);
        User actor = actorUserId == null ? null : userRepository.findById(actorUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", actorUserId));
        long affected = userAdminRoleRepository.deleteByUserIdAndAdminRole(targetUserId, role);
        if (affected == 0) {
            throw new EntityNotFoundException("User admin role", targetUserId);
        }
        auditService.append(new RevampAuditEventInputDto(
                "revamp.admin-role.revoked",
                "REVAMP_USER_ADMIN_ROLE",
                targetUserId,
                actorUserId,
                actor != null && actor.getRole() != null ? actor.getRole().name() : null,
                null,
                "revoke admin role",
                "{\"role\":\"" + role.name() + "\"}",
                "{\"role\":null}",
                "{\"targetUserName\":\"" + esc(target != null ? target.getEmail() : "") + "\",\"role\":\"" + role.name() + "\"}"
        ));
    }

    @Transactional(readOnly = true)
    public List<RevampAdminUserRoleDto> listAdminUsersWithRoles(String query, boolean archivedOnly) {
        List<User> users = userRepository.findByRoleIn(EnumSet.of(UserRole.ADMIN));
        Map<UUID, List<AdminRole>> roleMap = new HashMap<>();
        for (RevampUserAdminRole assignment : userAdminRoleRepository.findAll()) {
            UUID userId = assignment.getUser().getId();
            roleMap.computeIfAbsent(userId, ignored -> new ArrayList<>()).add(assignment.getAdminRole());
        }

        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return users.stream()
                .filter(user -> archivedOnly ? user.getDeletedAt() != null : user.getDeletedAt() == null)
                .filter(user -> normalizedQuery.isBlank() || matchesQuery(user, normalizedQuery))
                .sorted(Comparator.comparing(User::getEmail, String.CASE_INSENSITIVE_ORDER))
                .map(user -> toDto(user, roleMap.getOrDefault(user.getId(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public RevampAdminUserRoleDto getAdminUserWithRoles(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User", userId));
        List<AdminRole> roles = userAdminRoleRepository.findByUserId(userId).stream()
                .map(RevampUserAdminRole::getAdminRole)
                .sorted()
                .toList();
        return toDto(user, roles);
    }

    @Transactional
    public RevampAdminUserRoleDto deactivateAdminUser(UUID targetUserId, UUID actorUserId) {
        requireSuperAdmin(actorUserId);
        User target = loadLifecycleTarget(targetUserId, actorUserId);
        if (target.getDeletedAt() != null) {
            throw new IllegalStateException("Archived admin users cannot be deactivated");
        }
        User actor = loadActor(actorUserId);
        List<AdminRole> roles = rolesFor(targetUserId);
        enforceLifecycleAllowed(targetUserId, actorUserId, roles, "deactivate");

        boolean beforeActive = Boolean.TRUE.equals(target.getIsActive());
        target.setIsActive(false);
        User saved = userRepository.save(target);
        appendLifecycleAudit("revamp.admin-user.deactivated", saved, actor, actorUserId, beforeActive, false, "deactivate admin user");
        return toDto(saved, roles);
    }

    @Transactional
    public RevampAdminUserRoleDto reactivateAdminUser(UUID targetUserId, UUID actorUserId) {
        requireSuperAdmin(actorUserId);
        User target = loadLifecycleTarget(targetUserId, actorUserId);
        User actor = loadActor(actorUserId);
        if (target.getDeletedAt() != null) {
            throw new IllegalStateException("Archived admin users cannot be reactivated");
        }
        if (target.getInviteToken() != null) {
            throw new IllegalStateException("Pending admin invites must be activated by the invited user");
        }

        List<AdminRole> roles = rolesFor(targetUserId);
        boolean beforeActive = Boolean.TRUE.equals(target.getIsActive());
        target.setIsActive(true);
        User saved = userRepository.save(target);
        appendLifecycleAudit("revamp.admin-user.reactivated", saved, actor, actorUserId, beforeActive, true, "reactivate admin user");
        return toDto(saved, roles);
    }

    @Transactional
    public void archiveAdminUser(UUID targetUserId, UUID actorUserId) {
        requireSuperAdmin(actorUserId);
        User target = loadLifecycleTarget(targetUserId, actorUserId);
        if (target.getDeletedAt() != null) {
            throw new IllegalStateException("Admin user is already archived");
        }
        User actor = loadActor(actorUserId);
        List<AdminRole> roles = rolesFor(targetUserId);
        enforceLifecycleAllowed(targetUserId, actorUserId, roles, "archive");

        boolean beforeActive = Boolean.TRUE.equals(target.getIsActive());
        target.setIsActive(false);
        target.setDeletedAt(LocalDateTime.now());
        User saved = userRepository.save(target);
        appendLifecycleAudit("revamp.admin-user.archived", saved, actor, actorUserId, beforeActive, false, "archive admin user");
    }

    private boolean matchesQuery(User user, String query) {
        String email = user.getEmail() == null ? "" : user.getEmail().toLowerCase(Locale.ROOT);
        return email.contains(query);
    }

    private RevampAdminUserRoleDto toDto(User user, List<AdminRole> roles) {
        List<AdminRole> sortedRoles = roles.stream().sorted().toList();
        return new RevampAdminUserRoleDto(
                user.getId(),
                user.getEmail(),
                user.getRole(),
                Boolean.TRUE.equals(user.getIsActive()),
                user.getDeletedAt() != null,
                accountStatus(user),
                sortedRoles
        );
    }

    private AdminAccountStatus accountStatus(User user) {
        if (user.getDeletedAt() != null) {
            return AdminAccountStatus.ARCHIVED;
        }
        if (Boolean.TRUE.equals(user.getIsActive())) {
            return AdminAccountStatus.ACTIVE;
        }
        if (user.getInviteToken() != null) {
            if (user.getInviteExpiresAt() != null && user.getInviteExpiresAt().isBefore(LocalDateTime.now())) {
                return AdminAccountStatus.INVITE_EXPIRED;
            }
            return AdminAccountStatus.INVITE_PENDING;
        }
        return AdminAccountStatus.DEACTIVATED;
    }

    private User loadLifecycleTarget(UUID targetUserId, UUID actorUserId) {
        if (actorUserId != null && actorUserId.equals(targetUserId)) {
            throw new AccessDeniedException("Cannot change lifecycle state for your own account");
        }
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", targetUserId));
        if (target.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Lifecycle actions are allowed only for ADMIN users");
        }
        return target;
    }

    private User loadActor(UUID actorUserId) {
        return actorUserId == null ? null : userRepository.findById(actorUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", actorUserId));
    }

    private List<AdminRole> rolesFor(UUID userId) {
        return userAdminRoleRepository.findByUserId(userId).stream()
                .map(RevampUserAdminRole::getAdminRole)
                .sorted()
                .toList();
    }

    private void enforceLifecycleAllowed(UUID targetUserId, UUID actorUserId, List<AdminRole> roles, String action) {
        if (actorUserId != null && actorUserId.equals(targetUserId)) {
            throw new AccessDeniedException("Cannot " + action + " your own account");
        }
        if (roles.contains(AdminRole.SUPER_ADMIN)) {
            throw new AccessDeniedException("Cannot " + action + " a current SUPER_ADMIN account");
        }
    }

    private void appendLifecycleAudit(
            String eventKey,
            User target,
            User actor,
            UUID actorUserId,
            boolean beforeActive,
            boolean afterActive,
            String reason
    ) {
        String beforeDeletedAt = target.getDeletedAt() == null ? null : target.getDeletedAt().toString();
        auditService.append(new RevampAuditEventInputDto(
                eventKey,
                "REVAMP_USER_ADMIN_ROLE",
                target.getId(),
                actorUserId,
                actor != null && actor.getRole() != null ? actor.getRole().name() : null,
                null,
                reason,
                "{\"active\":" + beforeActive + ",\"archived\":false}",
                "{\"active\":" + afterActive + ",\"archived\":" + (target.getDeletedAt() != null) + "}",
                "{\"targetUserName\":\"" + esc(target.getEmail()) + "\",\"targetEmail\":\"" + esc(target.getEmail()) + "\",\"deletedAt\":" + (beforeDeletedAt == null ? "null" : "\"" + esc(beforeDeletedAt) + "\"") + "}"
        ));
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private void enforceSuperAdminRemovalAllowed(UUID targetUserId, UUID actorUserId) {
        if (actorUserId != null && actorUserId.equals(targetUserId)) {
            throw new AccessDeniedException("Cannot remove your own SUPER_ADMIN role");
        }
        long activeSuperAdminCount = userAdminRoleRepository.countActiveByAdminRole(AdminRole.SUPER_ADMIN);
        if (activeSuperAdminCount <= 1) {
            throw new AccessDeniedException("Cannot remove last active SUPER_ADMIN role");
        }
    }
}
