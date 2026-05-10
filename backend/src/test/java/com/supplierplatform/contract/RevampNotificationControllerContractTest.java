package com.supplierplatform.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.revamp.api.dto.UpsertNotificationTemplateRequest;
import com.supplierplatform.revamp.dto.NotificationTemplateDto;
import com.supplierplatform.revamp.dto.RevampNotificationEventSummaryDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.NotificationDeliveryStatus;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampNotificationEventService;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRole;
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
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class RevampNotificationControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RevampNotificationEventService notificationEventService;

    @MockBean
    private RevampGovernanceAuthorizationService governanceAuthorizationService;

    @BeforeEach
    void setAuthentication() {
        User adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin.revamp.notify@test.com");
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
    void templatesReturnsExpectedContract() throws Exception {
        when(notificationEventService.getTemplates()).thenReturn(List.of(
                new NotificationTemplateDto("invite_created", "Hello {{name}}")
        ));

        mockMvc.perform(get("/api/v2/notifications/templates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].key").value("invite_created"));
    }

    @Test
    void upsertTemplateReturnsExpectedContract() throws Exception {
        UpsertNotificationTemplateRequest request = new UpsertNotificationTemplateRequest();
        request.setContent("Updated");

        when(notificationEventService.upsertTemplate(eq("invite_created"), eq("Updated")))
                .thenReturn(new NotificationTemplateDto("invite_created", "Updated"));

        mockMvc.perform(put("/api/v2/notifications/templates/{key}", "invite_created")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Template updated"))
                .andExpect(jsonPath("$.data.content").value("Updated"));
    }

    @Test
    void eventsReturnsExpectedContract() throws Exception {
        UUID entityId = UUID.randomUUID();
        UUID eventId = UUID.randomUUID();
        when(notificationEventService.listEvents(eq("REVAMP_APPLICATION"), eq(entityId), eq(NotificationDeliveryStatus.SENT)))
                .thenReturn(List.of(new RevampNotificationEventSummaryDto(
                        eventId,
                        "revamp.application.submitted",
                        "REVAMP_APPLICATION",
                        entityId,
                        "supplier@test.com",
                        "submission_ok",
                        1,
                        "SENT",
                        0,
                        LocalDateTime.now(),
                        LocalDateTime.now(),
                        null
                )));

        mockMvc.perform(get("/api/v2/notifications/events")
                        .param("entityType", "REVAMP_APPLICATION")
                        .param("entityId", entityId.toString())
                        .param("status", "SENT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(eventId.toString()))
                .andExpect(jsonPath("$.data[0].deliveryStatus").value("SENT"));
    }

}
