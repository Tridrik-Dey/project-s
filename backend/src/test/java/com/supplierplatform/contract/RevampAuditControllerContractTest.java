package com.supplierplatform.contract;

import com.supplierplatform.revamp.dto.RevampAuditEventSummaryDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampAuditService;
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
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class RevampAuditControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RevampAuditService auditService;

    @MockBean
    private RevampGovernanceAuthorizationService governanceAuthorizationService;

    @BeforeEach
    void setAuthentication() {
        User adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin.revamp.audit@test.com");
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setPasswordHash("hash");
        adminUser.setIsActive(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(adminUser, null, adminUser.getAuthorities()));
        SecurityContextHolder.setContext(context);
        when(governanceAuthorizationService.requireAnyRole(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(AdminRole[].class)))
                .thenReturn(AdminRole.SUPER_ADMIN);
    }

    @Test
    void eventsReturnsExpectedContract() throws Exception {
        UUID entityId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        when(auditService.listEvents(eq("REVAMP_APPLICATION"), eq(entityId), eq("req-1")))
                .thenReturn(List.of(new RevampAuditEventSummaryDto(
                        eventId,
                        "revamp.application.submitted",
                        "REVAMP_APPLICATION",
                        entityId,
                        UUID.randomUUID(),
                        "SUPPLIER",
                        "req-1",
                        null,
                        "{\"status\":\"DRAFT\"}",
                        "{\"status\":\"SUBMITTED\"}",
                        "{}",
                        LocalDateTime.now()
                )));

        mockMvc.perform(get("/api/v2/audit/events")
                        .param("entityType", "REVAMP_APPLICATION")
                        .param("entityId", entityId.toString())
                        .param("requestId", "req-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(eventId.toString()))
                .andExpect(jsonPath("$.data[0].requestId").value("req-1"))
                .andExpect(jsonPath("$.data[0].entityType").value("REVAMP_APPLICATION"));
    }

}

