package com.supplierplatform.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.revamp.api.dto.AssignReviewCaseRequest;
import com.supplierplatform.revamp.api.dto.ReviewDecisionRequest;
import com.supplierplatform.revamp.api.dto.ReviewIntegrationRequest;
import com.supplierplatform.revamp.api.dto.VerifyReviewCaseRequest;
import com.supplierplatform.revamp.dto.RevampIntegrationRequestSummaryDto;
import com.supplierplatform.revamp.dto.RevampReviewCaseSummaryDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.ReviewDecision;
import com.supplierplatform.revamp.enums.VerificationOutcome;
import com.supplierplatform.revamp.service.RevampGovernanceAuthorizationService;
import com.supplierplatform.revamp.service.RevampReviewWorkflowService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class RevampReviewControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RevampReviewWorkflowService reviewWorkflowService;

    @MockBean
    private RevampGovernanceAuthorizationService governanceAuthorizationService;

    private User adminUser;

    @BeforeEach
    void setAuthentication() {
        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin.revamp.review@test.com");
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
    void queueReturnsExpectedContract() throws Exception {
        UUID appId = UUID.randomUUID();
        UUID caseId = UUID.randomUUID();
        RevampReviewCaseSummaryDto row = new RevampReviewCaseSummaryDto(
                caseId,
                appId,
                "IN_PROGRESS",
                null,
                adminUser.getId(),
                adminUser.getEmail(),
                LocalDateTime.now(),
                LocalDateTime.now().plusDays(3),
                null, null, null, null,
                null,
                LocalDateTime.now()
        );
        when(reviewWorkflowService.getQueue()).thenReturn(List.of(row));

        mockMvc.perform(get("/api/v2/reviews/queue"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(caseId.toString()))
                .andExpect(jsonPath("$.data[0].applicationId").value(appId.toString()))
                .andExpect(jsonPath("$.data[0].status").value("IN_PROGRESS"));
    }

    @Test
    void assignReturnsExpectedContract() throws Exception {
        UUID appId = UUID.randomUUID();
        UUID assigneeId = UUID.randomUUID();
        UUID caseId = UUID.randomUUID();
        LocalDateTime dueAt = LocalDateTime.now().plusDays(5);

        RevampReviewCaseSummaryDto dto = new RevampReviewCaseSummaryDto(
                caseId,
                appId,
                "IN_PROGRESS",
                null,
                assigneeId,
                "Assignee Admin",
                LocalDateTime.now(),
                dueAt,
                null, null, null, null,
                null,
                LocalDateTime.now()
        );
        when(reviewWorkflowService.openCase(eq(appId), eq(assigneeId), eq(dueAt))).thenReturn(dto);

        AssignReviewCaseRequest request = new AssignReviewCaseRequest();
        request.setAssignedToUserId(assigneeId);
        request.setSlaDueAt(dueAt);

        mockMvc.perform(post("/api/v2/reviews/{applicationId}/assign", appId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Review case assigned"))
                .andExpect(jsonPath("$.data.id").value(caseId.toString()))
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"));
    }

    @Test
    void integrationRequestReturnsExpectedContract() throws Exception {
        UUID caseId = UUID.randomUUID();
        UUID appId = UUID.randomUUID();
        RevampReviewCaseSummaryDto dto = new RevampReviewCaseSummaryDto(
                caseId,
                appId,
                "WAITING_SUPPLIER_RESPONSE",
                null,
                adminUser.getId(),
                adminUser.getEmail(),
                LocalDateTime.now(),
                LocalDateTime.now().plusDays(7),
                null, null, null, null,
                null,
                LocalDateTime.now()
        );
        ReviewIntegrationRequest request = new ReviewIntegrationRequest();
        request.setDueAt(LocalDateTime.now().plusDays(7));
        request.setMessage("Missing DURC");
        request.setRequestedItemsJson("[\"durc\"]");

        when(reviewWorkflowService.requestIntegration(
                eq(caseId),
                eq(adminUser.getId()),
                eq(request.getDueAt()),
                eq("Missing DURC"),
                eq("[\"durc\"]")
        )).thenReturn(dto);

        mockMvc.perform(post("/api/v2/reviews/{reviewCaseId}/integration-request", caseId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Integration requested"))
                .andExpect(jsonPath("$.data.status").value("WAITING_SUPPLIER_RESPONSE"));
    }

    @Test
    void decisionReturnsExpectedContract() throws Exception {
        UUID caseId = UUID.randomUUID();
        UUID appId = UUID.randomUUID();
        RevampReviewCaseSummaryDto dto = new RevampReviewCaseSummaryDto(
                caseId,
                appId,
                "DECIDED",
                "APPROVED",
                adminUser.getId(),
                adminUser.getEmail(),
                LocalDateTime.now(),
                LocalDateTime.now().plusDays(2),
                null, null, null, null,
                null,
                LocalDateTime.now()
        );
        ReviewDecisionRequest request = new ReviewDecisionRequest();
        request.setDecision(ReviewDecision.APPROVED);
        request.setReason("Complete profile");

        when(reviewWorkflowService.decide(
                eq(caseId),
                eq(ReviewDecision.APPROVED),
                eq("Complete profile"),
                eq(adminUser.getId())
        )).thenReturn(dto);

        mockMvc.perform(post("/api/v2/reviews/{reviewCaseId}/decision", caseId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Review decision saved"))
                .andExpect(jsonPath("$.data.status").value("DECIDED"))
                .andExpect(jsonPath("$.data.decision").value("APPROVED"));
    }

    @Test
    void historyReturnsExpectedContract() throws Exception {
        UUID appId = UUID.randomUUID();
        UUID caseId = UUID.randomUUID();
        RevampReviewCaseSummaryDto row = new RevampReviewCaseSummaryDto(
                caseId,
                appId,
                "DECIDED",
                "REJECTED",
                adminUser.getId(),
                adminUser.getEmail(),
                LocalDateTime.now(),
                LocalDateTime.now().plusDays(1),
                null, null, null, null,
                null,
                LocalDateTime.now()
        );
        when(reviewWorkflowService.getHistory(eq(appId))).thenReturn(List.of(row));

        mockMvc.perform(get("/api/v2/reviews/{applicationId}/history", appId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(caseId.toString()))
                .andExpect(jsonPath("$.data[0].decision").value("REJECTED"));
    }

    @Test
    void latestIntegrationReturnsExpectedContract() throws Exception {
        UUID caseId = UUID.randomUUID();
        RevampIntegrationRequestSummaryDto dto = new RevampIntegrationRequestSummaryDto(
                UUID.randomUUID(),
                caseId,
                "OPEN",
                LocalDateTime.now().plusDays(3),
                "Missing DURC",
                objectMapper.readTree("{\"items\":[{\"code\":\"ID_DOCUMENT\"}]}"),
                objectMapper.readTree("{\"completedItemCodes\":[]}"),
                LocalDateTime.now()
        );
        when(reviewWorkflowService.getLatestIntegrationRequest(eq(caseId))).thenReturn(dto);

        mockMvc.perform(get("/api/v2/reviews/{reviewCaseId}/integration-latest", caseId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.reviewCaseId").value(caseId.toString()))
                .andExpect(jsonPath("$.data.status").value("OPEN"));
    }

    @Test
    void verifyReturnsExpectedContract() throws Exception {
        UUID caseId = UUID.randomUUID();
        UUID appId = UUID.randomUUID();
        RevampReviewCaseSummaryDto dto = new RevampReviewCaseSummaryDto(
                caseId,
                appId,
                "READY_FOR_DECISION",
                null,
                adminUser.getId(),
                adminUser.getEmail(),
                LocalDateTime.now(),
                LocalDateTime.now().plusDays(2),
                adminUser.getId(),
                adminUser.getEmail(),
                LocalDateTime.now(),
                "Checklist completata",
                "COMPLIANT",
                LocalDateTime.now()
        );
        VerifyReviewCaseRequest request = new VerifyReviewCaseRequest();
        request.setVerificationNote("Checklist completata");
        request.setVerificationOutcome(VerificationOutcome.COMPLIANT);

        when(reviewWorkflowService.verifyCase(
                eq(caseId),
                eq(adminUser.getId()),
                eq("Checklist completata"),
                eq(VerificationOutcome.COMPLIANT)
        )).thenReturn(dto);

        mockMvc.perform(post("/api/v2/reviews/{reviewCaseId}/verify", caseId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Review case verified"))
                .andExpect(jsonPath("$.data.status").value("READY_FOR_DECISION"))
                .andExpect(jsonPath("$.data.verificationOutcome").value("COMPLIANT"));
    }
}
