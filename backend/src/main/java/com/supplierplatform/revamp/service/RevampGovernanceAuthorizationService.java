package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.model.RevampUserAdminRole;
import com.supplierplatform.revamp.repository.RevampUserAdminRoleRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampGovernanceAuthorizationService {

    private final UserRepository userRepository;
    private final RevampUserAdminRoleRepository userAdminRoleRepository;

    @Transactional(readOnly = true)
    public AdminRole requireAnyRole(UUID actorUserId, AdminRole... allowedRoles) {
        if (allowedRoles == null || allowedRoles.length == 0) {
            throw new AccessDeniedException("Access denied");
        }
        AdminRole actorRole = resolveAdminGovernanceRole(actorUserId);
        EnumSet<AdminRole> allowed = EnumSet.noneOf(AdminRole.class);
        for (AdminRole role : allowedRoles) {
            if (role != null) {
                allowed.add(role);
            }
        }
        if (!allowed.contains(actorRole)) {
            throw new AccessDeniedException("Access denied for governance role: " + actorRole.name());
        }
        return actorRole;
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public AdminRole resolveAdminGovernanceRole(UUID actorUserId) {
        if (actorUserId == null) {
            throw new AccessDeniedException("Access denied");
        }
        User actor = userRepository.findById(actorUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", actorUserId));
        if (actor.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("Access denied");
        }

        List<RevampUserAdminRole> assignments = userAdminRoleRepository.findByUserId(actorUserId);
        if (assignments.size() != 1) {
            throw new AccessDeniedException("Access denied: invalid governance profile configuration");
        }
        return assignments.get(0).getAdminRole();
    }
}
