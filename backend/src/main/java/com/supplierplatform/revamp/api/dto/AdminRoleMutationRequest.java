package com.supplierplatform.revamp.api.dto;

import com.supplierplatform.revamp.enums.AdminRole;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public class AdminRoleMutationRequest {

    @NotNull
    private UUID targetUserId;

    @NotNull
    private AdminRole adminRole;

    public UUID getTargetUserId() {
        return targetUserId;
    }

    public void setTargetUserId(UUID targetUserId) {
        this.targetUserId = targetUserId;
    }

    public AdminRole getAdminRole() {
        return adminRole;
    }

    public void setAdminRole(AdminRole adminRole) {
        this.adminRole = adminRole;
    }
}

