package com.supplierplatform.auth.dto;

import com.supplierplatform.user.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    private String token;
    private UUID userId;
    private String email;
    private UserRole role;
    private String adminGovernanceRole;
    private boolean emailVerified;
}
