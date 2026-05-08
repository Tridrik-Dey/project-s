package com.supplierplatform.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.revamp.api.dto.CreateInviteRequest;
import com.supplierplatform.revamp.dto.RevampInviteListRowDto;
import com.supplierplatform.revamp.dto.RevampInviteMonitorDto;
import com.supplierplatform.revamp.dto.RevampInviteReminderRunDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.InviteStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampInvite;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampInviteExpiryReminderService;
import com.supplierplatform.revamp.service.RevampInviteService;
import com.supplierplatform.revamp.service.RevampSupplierInviteMailService;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRole;
import com.supplierplatform.validation.EmailDeliverabilityValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class RevampInviteControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RevampInviteService inviteService;

    @MockBean
    private RevampInviteExpiryReminderService inviteExpiryReminderService;

    @MockBean
    private RevampSupplierInviteMailService supplierInviteMailService;

    @MockBean
    private EmailDeliverabilityValidator emailDeliverabilityValidator;

    @MockBean
    private RevampGovernanceAuthorizationService governanceAuthorizationService;

    private User adminUser;

    @BeforeEach
    void setAuthentication() {
        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin.revamp.contract@test.com");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setPasswordHash("hash");
        adminUser.setIsActive(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(adminUser, null, adminUser.getAuthorities()));
        SecurityContextHolder.setContext(context);
        when(governanceAuthorizationService.requireAnyRole(any(), any(AdminRole[].class))).thenReturn(AdminRole.SUPER_ADMIN);
    }

    @Test
    void createInviteReturnsExpectedContract() throws Exception {
        UUID inviteId = UUID.randomUUID();
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(30);
        RevampInvite invite = new RevampInvite();
        invite.setId(inviteId);
        invite.setToken("testtoken123");
        invite.setStatus(InviteStatus.CREATED);
        invite.setRegistryType(RegistryType.ALBO_A);
        invite.setInvitedEmail("invited@test.com");
        invite.setExpiresAt(expiresAt);

        when(inviteService.createInvite(
                eq(RegistryType.ALBO_A),
                eq("invited@test.com"),
                eq("Invited Name"),
                eq(adminUser.getId()),
                any(LocalDateTime.class),
                eq("note")
        )).thenReturn(invite);
        RevampInvite sentInvite = new RevampInvite();
        sentInvite.setId(inviteId);
        sentInvite.setToken("testtoken123");
        sentInvite.setStatus(InviteStatus.SENT);
        sentInvite.setRegistryType(RegistryType.ALBO_A);
        sentInvite.setInvitedEmail("invited@test.com");
        sentInvite.setExpiresAt(expiresAt);
        when(supplierInviteMailService.sendInvite(invite))
                .thenReturn(new RevampSupplierInviteMailService.InviteDispatchResult(true, "http://127.0.0.1:5173/invite/testtoken123", null));
        when(inviteService.markSent(eq(inviteId), eq(adminUser.getId()))).thenReturn(sentInvite);
        when(emailDeliverabilityValidator.hasReceivableDomain("invited@test.com")).thenReturn(true);

        CreateInviteRequest request = new CreateInviteRequest();
        request.setRegistryType(RegistryType.ALBO_A);
        request.setInvitedEmail("invited@test.com");
        request.setInvitedName("Invited Name");
        request.setExpiresInDays(30);
        request.setNote("note");

        mockMvc.perform(post("/api/v2/invites")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Invite created and email sent"))
                .andExpect(jsonPath("$.data.id").value(inviteId.toString()))
                .andExpect(jsonPath("$.data.token").value("testtoken123"))
                .andExpect(jsonPath("$.data.status").value("SENT"))
                .andExpect(jsonPath("$.data.registryType").value("ALBO_A"))
                .andExpect(jsonPath("$.data.invitedEmail").value("invited@test.com"))
                .andExpect(jsonPath("$.data.expiresAt").exists())
                .andExpect(jsonPath("$.data.mailSent").value(true))
                .andExpect(jsonPath("$.data.inviteUrl").value("http://127.0.0.1:5173/invite/testtoken123"));
    }

    @Test
    void getInviteByTokenReturnsExpectedContract() throws Exception {
        UUID inviteId = UUID.randomUUID();
        RevampInvite invite = new RevampInvite();
        invite.setId(inviteId);
        invite.setStatus(InviteStatus.OPENED);
        invite.setRegistryType(RegistryType.ALBO_B);
        invite.setInvitedName("Company Contact");
        invite.setInvitedEmail("company@test.com");
        invite.setExpiresAt(LocalDateTime.now().plusDays(10));

        when(inviteService.getByToken("token-xyz")).thenReturn(invite);

        mockMvc.perform(get("/api/v2/invites/token/token-xyz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Success"))
                .andExpect(jsonPath("$.data.id").value(inviteId.toString()))
                .andExpect(jsonPath("$.data.status").value("OPENED"))
                .andExpect(jsonPath("$.data.registryType").value("ALBO_B"))
                .andExpect(jsonPath("$.data.invitedName").value("Company Contact"))
                .andExpect(jsonPath("$.data.invitedEmail").value("company@test.com"))
                .andExpect(jsonPath("$.data.expiresAt").exists());
    }

    @Test
    void getInviteByTokenAliasPathIsNotAvailable() throws Exception {
        mockMvc.perform(get("/api/invites/token/token-xyz"))
                .andExpect(status().isNotFound());
    }

    @Test
    void monitorInvitesReturnsExpectedContract() throws Exception {
        UUID inviteId = UUID.randomUUID();
        RevampInviteListRowDto row = new RevampInviteListRowDto(
                inviteId,
                "Mario Bianchi",
                "mario@test.com",
                "ALBO_A",
                "OPENED",
                "IN_COMPILAZIONE",
                55,
                LocalDateTime.now().minusDays(2),
                LocalDateTime.now().plusDays(20),
                "Admin User",
                "Nota interna",
                UUID.randomUUID(),
                "/admin/candidature/sample/review",
                false,
                true
        );
        RevampInviteMonitorDto dto = new RevampInviteMonitorDto(10, 3, 5, 2, java.util.List.of(row));
        when(inviteService.monitorInvites()).thenReturn(dto);

        mockMvc.perform(get("/api/v2/invites"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.totalInvites").value(10))
                .andExpect(jsonPath("$.data.completedInvites").value(3))
                .andExpect(jsonPath("$.data.rows[0].id").value(inviteId.toString()))
                .andExpect(jsonPath("$.data.rows[0].uiStatus").value("IN_COMPILAZIONE"));
    }

    @Test
    void runInviteExpiryRemindersReturnsExpectedContract() throws Exception {
        when(inviteExpiryReminderService.runNow(any()))
                .thenReturn(new RevampInviteReminderRunDto(3, 2, 1, 0));

        mockMvc.perform(post("/api/v2/invites/reminders/run"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Invite expiry reminder run completed"))
                .andExpect(jsonPath("$.data.scanned").value(3))
                .andExpect(jsonPath("$.data.sent").value(2))
                .andExpect(jsonPath("$.data.skippedDuplicate").value(1))
                .andExpect(jsonPath("$.data.failed").value(0));
    }

    @Test
    void renewInviteReturnsExpectedContract() throws Exception {
        UUID inviteId = UUID.randomUUID();
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(30);
        RevampInvite renewed = new RevampInvite();
        renewed.setId(UUID.randomUUID());
        renewed.setToken("renewedtoken123");
        renewed.setStatus(InviteStatus.CREATED);
        renewed.setRegistryType(RegistryType.ALBO_B);
        renewed.setInvitedEmail("renew@test.com");
        renewed.setExpiresAt(expiresAt);
        RevampInvite sentRenewed = new RevampInvite();
        sentRenewed.setId(renewed.getId());
        sentRenewed.setToken("renewedtoken123");
        sentRenewed.setStatus(InviteStatus.SENT);
        sentRenewed.setRegistryType(RegistryType.ALBO_B);
        sentRenewed.setInvitedEmail("renew@test.com");
        sentRenewed.setExpiresAt(expiresAt);

        when(inviteService.renewInvite(eq(inviteId), eq(adminUser.getId()), eq(30))).thenReturn(renewed);
        when(supplierInviteMailService.sendInvite(renewed))
                .thenReturn(new RevampSupplierInviteMailService.InviteDispatchResult(true, "http://127.0.0.1:5173/invite/renewedtoken123", null));
        when(inviteService.markSent(eq(renewed.getId()), eq(adminUser.getId()))).thenReturn(sentRenewed);

        mockMvc.perform(post("/api/v2/invites/{inviteId}/renew", inviteId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expiresInDays\":30}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Invite renewed and email sent"))
                .andExpect(jsonPath("$.data.id").value(renewed.getId().toString()))
                .andExpect(jsonPath("$.data.token").value("renewedtoken123"))
                .andExpect(jsonPath("$.data.status").value("SENT"))
                .andExpect(jsonPath("$.data.registryType").value("ALBO_B"))
                .andExpect(jsonPath("$.data.mailSent").value(true));
    }
}

