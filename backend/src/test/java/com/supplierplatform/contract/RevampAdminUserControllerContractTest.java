package com.supplierplatform.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.config.RevampAccessGuard;
import com.supplierplatform.revamp.api.dto.CreateAdminUserInviteRequest;
import com.supplierplatform.revamp.dto.AdminUserInviteDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampAdminUserProvisioningService;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class RevampAdminUserControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RevampAccessGuard revampAccessGuard;

    @MockBean
    private RevampAdminUserProvisioningService provisioningService;

    @MockBean
    private RevampGovernanceAuthorizationService governanceAuthorizationService;

    private User adminUser;

    @BeforeEach
    void setAuthentication() {
        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("super.admin@test.com");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setPasswordHash("hash");
        adminUser.setIsActive(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(adminUser, null, adminUser.getAuthorities()));
        SecurityContextHolder.setContext(context);
        when(governanceAuthorizationService.requireAnyRole(eq(adminUser.getId()), eq(AdminRole.SUPER_ADMIN)))
                .thenReturn(AdminRole.SUPER_ADMIN);
    }

    @Test
    void createAdminInviteReturnsExpectedContract() throws Exception {
        UUID invitedUserId = UUID.randomUUID();
        AdminUserInviteDto response = new AdminUserInviteDto(
                invitedUserId,
                "new.admin@test.com",
                AdminRole.REVISORE,
                LocalDateTime.now().plusDays(7)
        );

        CreateAdminUserInviteRequest request = new CreateAdminUserInviteRequest();
        request.setEmail("new.admin@test.com");
        request.setAdminRole(AdminRole.REVISORE);
        request.setExpiresInDays(7);

        doNothing().when(revampAccessGuard).requireWriteEnabled();
        when(provisioningService.inviteAdminUser(
                eq("new.admin@test.com"),
                eq(AdminRole.REVISORE),
                eq(7),
                eq(adminUser.getId())
        )).thenReturn(response);

        mockMvc.perform(post("/api/v2/admin/users/invite")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Admin invite created"))
                .andExpect(jsonPath("$.data.userId").value(invitedUserId.toString()))
                .andExpect(jsonPath("$.data.email").value("new.admin@test.com"))
                .andExpect(jsonPath("$.data.adminRole").value("REVISORE"))
                .andExpect(jsonPath("$.data.inviteExpiresAt").exists());
    }
}
