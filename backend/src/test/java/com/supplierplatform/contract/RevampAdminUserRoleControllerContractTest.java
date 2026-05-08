package com.supplierplatform.contract;

import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.dto.RevampAdminUserRoleDto;
import com.supplierplatform.revamp.dto.AdminAccountStatus;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampAdminRoleService;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class RevampAdminUserRoleControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RevampAdminRoleService adminRoleService;

    @MockBean
    private RevampAccessGuard revampAccessGuard;

    private User adminUser;

    @BeforeEach
    void setAuthentication() {
        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin.contract@test.com");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setPasswordHash("hash");
        adminUser.setIsActive(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(adminUser, null, adminUser.getAuthorities()));
        SecurityContextHolder.setContext(context);
    }

    @Test
    void listReturnsForbiddenWhenActorIsNotSuperAdmin() throws Exception {
        doNothing().when(revampAccessGuard).requireReadEnabled();
        doThrow(new AccessDeniedException("Only SUPER_ADMIN can perform this action"))
                .when(adminRoleService).requireSuperAdmin(any(UUID.class));

        mockMvc.perform(get("/api/v2/admin/users-roles"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("ACCESS_DENIED"));
    }

    @Test
    void listReturnsRowsWhenActorIsSuperAdmin() throws Exception {
        UUID userId = UUID.randomUUID();
        RevampAdminUserRoleDto row = new RevampAdminUserRoleDto(
                userId,
                "admin.one@test.com",
                UserRole.ADMIN,
                true,
                false,
                AdminAccountStatus.ACTIVE,
                List.of(AdminRole.SUPER_ADMIN)
        );

        doNothing().when(revampAccessGuard).requireReadEnabled();
        doNothing().when(adminRoleService).requireSuperAdmin(eq(adminUser.getId()));
        when(adminRoleService.listAdminUsersWithRoles("admin", true)).thenReturn(List.of(row));

        mockMvc.perform(get("/api/v2/admin/users-roles")
                        .param("query", "admin")
                        .param("archivedOnly", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].userId").value(userId.toString()))
                .andExpect(jsonPath("$.data[0].adminRoles[0]").value("SUPER_ADMIN"));
    }

    @Test
    void meReturnsCurrentAdminGovernanceProfile() throws Exception {
        RevampAdminUserRoleDto me = new RevampAdminUserRoleDto(
                adminUser.getId(),
                adminUser.getEmail(),
                UserRole.ADMIN,
                true,
                false,
                AdminAccountStatus.ACTIVE,
                List.of(AdminRole.REVISORE)
        );

        doNothing().when(revampAccessGuard).requireReadEnabled();
        when(adminRoleService.getAdminUserWithRoles(eq(adminUser.getId()))).thenReturn(me);

        mockMvc.perform(get("/api/v2/admin/users-roles/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.userId").value(adminUser.getId().toString()))
                .andExpect(jsonPath("$.data.adminRoles[0]").value("REVISORE"));
    }
}
