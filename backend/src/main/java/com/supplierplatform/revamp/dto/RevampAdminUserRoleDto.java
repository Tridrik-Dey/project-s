package com.supplierplatform.revamp.dto;

import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.user.UserRole;

import java.util.List;
import java.util.UUID;

public record RevampAdminUserRoleDto(
        UUID userId,
        String email,
        UserRole userRole,
        boolean active,
        boolean archived,
        AdminAccountStatus accountStatus,
        List<AdminRole> adminRoles
) {
}
