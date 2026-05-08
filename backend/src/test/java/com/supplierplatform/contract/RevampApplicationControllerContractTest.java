package com.supplierplatform.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.config.RevampFeatureFlags;
import com.supplierplatform.observability.RequestCorrelationFilter;
import com.supplierplatform.revamp.api.dto.CreateApplicationDraftRequest;
import com.supplierplatform.revamp.api.dto.SaveApplicationSectionRequest;
import com.supplierplatform.revamp.dto.RevampApplicationSummaryDto;
import com.supplierplatform.revamp.dto.RevampSectionSnapshotDto;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.enums.SourceChannel;
import com.supplierplatform.revamp.service.RevampApplicationService;
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
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class RevampApplicationControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RevampApplicationService applicationService;

    @Autowired
    private RevampFeatureFlags revampFeatureFlags;

    private User supplierUser;

    @BeforeEach
    void setAuthentication() {
        supplierUser = new User();
        supplierUser.setId(UUID.randomUUID());
        supplierUser.setEmail("supplier.revamp.contract@test.com");
        supplierUser.setRole(UserRole.SUPPLIER);
        supplierUser.setPasswordHash("hash");
        supplierUser.setIsActive(true);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(supplierUser, null, supplierUser.getAuthorities()));
        SecurityContextHolder.setContext(context);

        ReflectionTestUtils.setField(revampFeatureFlags, "readEnabled", true);
        ReflectionTestUtils.setField(revampFeatureFlags, "writeEnabled", true);
        ReflectionTestUtils.setField(revampFeatureFlags, "aliasEnabled", true);
    }

    @Test
    void createDraftReturnsExpectedContract() throws Exception {
        UUID appId = UUID.randomUUID();
        RevampApplicationSummaryDto summary = new RevampApplicationSummaryDto(
                appId,
                supplierUser.getId(),
                "ALBO_A",
                "PUBLIC",
                "DRAFT",
                null,
                1,
                null,
                LocalDateTime.now()
        );

        when(applicationService.createDraft(
                eq(supplierUser.getId()),
                eq(RegistryType.ALBO_A),
                eq(SourceChannel.PUBLIC),
                eq(null)
        )).thenReturn(summary);

        CreateApplicationDraftRequest request = new CreateApplicationDraftRequest();
        request.setRegistryType(RegistryType.ALBO_A);
        request.setSourceChannel(SourceChannel.PUBLIC);
        request.setInviteId(null);

        mockMvc.perform(post("/api/v2/applications")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Draft created"))
                .andExpect(jsonPath("$.data.id").value(appId.toString()))
                .andExpect(jsonPath("$.data.registryType").value("ALBO_A"))
                .andExpect(jsonPath("$.data.sourceChannel").value("PUBLIC"))
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.currentRevision").value(1));
    }

    @Test
    void saveSectionReturnsExpectedContract() throws Exception {
        UUID appId = UUID.randomUUID();
        UUID sectionId = UUID.randomUUID();
        RevampSectionSnapshotDto section = new RevampSectionSnapshotDto(
                sectionId,
                appId,
                "S1",
                1,
                true,
                "{\"companyName\":\"Acme\"}",
                LocalDateTime.now()
        );

        when(applicationService.saveLatestSection(
                eq(appId),
                eq("S1"),
                eq("{\"companyName\":\"Acme\"}"),
                eq(true)
        )).thenReturn(section);

        SaveApplicationSectionRequest request = new SaveApplicationSectionRequest();
        request.setPayloadJson("{\"companyName\":\"Acme\"}");
        request.setCompleted(true);

        mockMvc.perform(put("/api/v2/applications/{applicationId}/sections/{sectionKey}", appId, "S1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Section saved"))
                .andExpect(jsonPath("$.data.id").value(sectionId.toString()))
                .andExpect(jsonPath("$.data.applicationId").value(appId.toString()))
                .andExpect(jsonPath("$.data.sectionKey").value("S1"))
                .andExpect(jsonPath("$.data.completed").value(true));
    }

    @Test
    void submitReturnsExpectedContract() throws Exception {
        UUID appId = UUID.randomUUID();
        RevampApplicationSummaryDto submitted = new RevampApplicationSummaryDto(
                appId,
                supplierUser.getId(),
                "ALBO_B",
                "INVITE",
                "SUBMITTED",
                "B-2026-1234",
                1,
                LocalDateTime.now(),
                LocalDateTime.now()
        );

        when(applicationService.submit(eq(appId))).thenReturn(submitted);

        mockMvc.perform(post("/api/v2/applications/{applicationId}/submit", appId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Application submitted"))
                .andExpect(jsonPath("$.data.id").value(appId.toString()))
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.protocolCode").value("B-2026-1234"));
    }

    @Test
    void getSectionsReturnsExpectedContract() throws Exception {
        UUID appId = UUID.randomUUID();
        RevampSectionSnapshotDto section = new RevampSectionSnapshotDto(
                UUID.randomUUID(),
                appId,
                "S2",
                2,
                false,
                "{}",
                LocalDateTime.now()
        );

        when(applicationService.getLatestSections(eq(appId))).thenReturn(List.of(section));

        mockMvc.perform(get("/api/v2/applications/{applicationId}/sections", appId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].applicationId").value(appId.toString()))
                .andExpect(jsonPath("$.data[0].sectionKey").value("S2"))
                .andExpect(jsonPath("$.data[0].sectionVersion").value(2));
    }

    @Test
    void createDraftValidationErrorIncludesLockedErrorContract() throws Exception {
        CreateApplicationDraftRequest request = new CreateApplicationDraftRequest();
        request.setInviteId(null);

        mockMvc.perform(post("/api/v2/applications")
                        .header(RequestCorrelationFilter.REQUEST_ID_HEADER, "req-contract-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.requestId").value("req-contract-001"))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    void getSummaryNotFoundIncludesLockedErrorContract() throws Exception {
        UUID appId = UUID.randomUUID();
        when(applicationService.getSummary(eq(appId)))
                .thenThrow(new EntityNotFoundException("RevampApplication", appId));

        mockMvc.perform(get("/api/v2/applications/{applicationId}", appId)
                        .header(RequestCorrelationFilter.REQUEST_ID_HEADER, "req-contract-404"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("ENTITY_NOT_FOUND"))
                .andExpect(jsonPath("$.requestId").value("req-contract-404"))
                .andExpect(jsonPath("$.message").value("RevampApplication not found with id: " + appId))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    void createDraftWhenRevampWriteDisabledReturnsConflict() throws Exception {
        ReflectionTestUtils.setField(revampFeatureFlags, "writeEnabled", false);
        CreateApplicationDraftRequest request = new CreateApplicationDraftRequest();
        request.setRegistryType(RegistryType.ALBO_A);
        request.setSourceChannel(SourceChannel.PUBLIC);

        mockMvc.perform(post("/api/v2/applications")
                        .header(RequestCorrelationFilter.REQUEST_ID_HEADER, "req-switch-write-off")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("ILLEGAL_STATE"))
                .andExpect(jsonPath("$.requestId").value("req-switch-write-off"))
                .andExpect(jsonPath("$.message").value("Revamp write path is disabled"));

        verifyNoInteractions(applicationService);
    }

    @Test
    void getSectionsWhenRevampReadDisabledReturnsConflict() throws Exception {
        ReflectionTestUtils.setField(revampFeatureFlags, "readEnabled", false);
        UUID appId = UUID.randomUUID();

        mockMvc.perform(get("/api/v2/applications/{applicationId}/sections", appId)
                        .header(RequestCorrelationFilter.REQUEST_ID_HEADER, "req-switch-read-off"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("ILLEGAL_STATE"))
                .andExpect(jsonPath("$.requestId").value("req-switch-read-off"))
                .andExpect(jsonPath("$.message").value("Revamp read path is disabled"));

        verifyNoInteractions(applicationService);
    }

    @Test
    void v2RouteStillWorksWhenAliasBridgeDisabled() throws Exception {
        ReflectionTestUtils.setField(revampFeatureFlags, "aliasEnabled", false);
        UUID appId = UUID.randomUUID();
        RevampSectionSnapshotDto section = new RevampSectionSnapshotDto(
                UUID.randomUUID(),
                appId,
                "S2",
                2,
                false,
                "{}",
                LocalDateTime.now()
        );
        when(applicationService.getLatestSections(eq(appId))).thenReturn(List.of(section));

        mockMvc.perform(get("/api/v2/applications/{applicationId}/sections", appId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].applicationId").value(appId.toString()))
                .andExpect(jsonPath("$.data[0].sectionKey").value("S2"))
                .andExpect(jsonPath("$.data[0].sectionVersion").value(2));
    }
}

