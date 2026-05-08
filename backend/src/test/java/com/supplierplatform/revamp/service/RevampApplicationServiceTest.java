package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampApplicationSummaryDto;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.IntegrationRequestStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.enums.ReviewCaseStatus;
import com.supplierplatform.revamp.enums.SourceChannel;
import com.supplierplatform.revamp.mapper.RevampApplicationMapper;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.repository.RevampApplicationAttachmentRepository;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampIntegrationRequestRepository;
import com.supplierplatform.revamp.repository.RevampOtpChallengeRepository;
import com.supplierplatform.revamp.repository.RevampReviewCaseRepository;
import com.supplierplatform.revamp.repository.RevampInviteRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
class RevampApplicationServiceTest {

    @Mock
    private RevampApplicationRepository applicationRepository;
    @Mock
    private RevampApplicationSectionRepository applicationSectionRepository;
    @Mock
    private RevampApplicationAttachmentRepository applicationAttachmentRepository;
    @Mock
    private RevampInviteRepository inviteRepository;
    @Mock
    private RevampReviewCaseRepository reviewCaseRepository;
    @Mock
    private RevampIntegrationRequestRepository integrationRequestRepository;
    @Mock
    private RevampOtpChallengeRepository otpChallengeRepository;
    @Mock
    private UserRepository userRepository;
    @Spy
    private RevampApplicationMapper applicationMapper = new RevampApplicationMapper();
    @Mock
    private RevampProtocolCodeService protocolCodeService;
    @Mock
    private RevampAuditService auditService;
    @Mock
    private RevampSectionPayloadValidator sectionPayloadValidator;
    @Mock
    private RevampAttachmentService attachmentService;
    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RevampApplicationService applicationService;

    @Test
    void createDraftCreatesDraftStatus() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(applicationRepository.save(any(RevampApplication.class))).thenAnswer(invocation -> {
            RevampApplication app = invocation.getArgument(0);
            app.setId(UUID.randomUUID());
            return app;
        });

        RevampApplicationSummaryDto dto = applicationService.createDraft(
                userId,
                RegistryType.ALBO_A,
                SourceChannel.PUBLIC,
                null
        );

        assertNotNull(dto.id());
        assertEquals(userId, dto.applicantUserId());
        assertEquals("ALBO_A", dto.registryType());
        assertEquals("PUBLIC", dto.sourceChannel());
        assertEquals("DRAFT", dto.status());
        assertEquals(1, dto.currentRevision());
        verify(auditService).append(any(RevampAuditEventInputDto.class));
    }

    @Test
    void submitAssignsProtocolAndSubmittedStatus() {
        UUID appId = UUID.randomUUID();
        User user = new User();
        user.setId(UUID.randomUUID());

        RevampApplication app = new RevampApplication();
        app.setId(appId);
        app.setApplicantUser(user);
        app.setRegistryType(RegistryType.ALBO_A);
        app.setSourceChannel(SourceChannel.PUBLIC);
        app.setStatus(ApplicationStatus.DRAFT);
        app.setCurrentRevision(1);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));
        when(protocolCodeService.nextProtocolCode(RegistryType.ALBO_A)).thenReturn("A-2026-1234");
        when(applicationRepository.save(any(RevampApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampApplicationSummaryDto dto = applicationService.submit(appId);

        assertEquals("SUBMITTED", dto.status());
        assertEquals("A-2026-1234", dto.protocolCode());
        assertNotNull(dto.submittedAt());
        verify(auditService).append(any(RevampAuditEventInputDto.class));
    }

    @Test
    void submitIntegrationResponseClosesOpenRequestAndReturnsCaseToReview() {
        UUID appId = UUID.randomUUID();
        User user = new User();
        user.setId(UUID.randomUUID());

        RevampApplication app = new RevampApplication();
        app.setId(appId);
        app.setApplicantUser(user);
        app.setRegistryType(RegistryType.ALBO_A);
        app.setSourceChannel(SourceChannel.PUBLIC);
        app.setStatus(ApplicationStatus.INTEGRATION_REQUIRED);
        app.setCurrentRevision(1);
        app.setProtocolCode("A-2026-1234");

        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setId(UUID.randomUUID());
        reviewCase.setApplication(app);
        reviewCase.setStatus(ReviewCaseStatus.WAITING_SUPPLIER_RESPONSE);

        RevampIntegrationRequest request = new RevampIntegrationRequest();
        request.setId(UUID.randomUUID());
        request.setReviewCase(reviewCase);
        request.setStatus(IntegrationRequestStatus.OPEN);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));
        when(integrationRequestRepository.findFirstByReviewCaseApplicationIdAndStatusOrderByCreatedAtDesc(appId, IntegrationRequestStatus.OPEN))
                .thenReturn(request);
        when(applicationRepository.save(any(RevampApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(integrationRequestRepository.save(any(RevampIntegrationRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewCaseRepository.save(any(RevampReviewCase.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampApplicationSummaryDto dto = applicationService.submit(appId);

        assertEquals("UNDER_REVIEW", dto.status());
        assertEquals(IntegrationRequestStatus.ANSWERED, request.getStatus());
        assertNotNull(request.getSupplierRespondedAt());
        assertNotNull(request.getSupplierResponseJson());
        assertEquals(ReviewCaseStatus.IN_PROGRESS, reviewCase.getStatus());
        verify(integrationRequestRepository).save(request);
        verify(reviewCaseRepository).save(reviewCase);
        verify(auditService, times(2)).append(any(RevampAuditEventInputDto.class));
    }

    @Test
    void answerIntegrationClosesRequestWithoutFullSubmitAudit() {
        UUID appId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);

        RevampApplication app = new RevampApplication();
        app.setId(appId);
        app.setApplicantUser(user);
        app.setRegistryType(RegistryType.ALBO_B);
        app.setSourceChannel(SourceChannel.PUBLIC);
        app.setStatus(ApplicationStatus.INTEGRATION_REQUIRED);
        app.setCurrentRevision(1);
        app.setProtocolCode("B-2026-1234");

        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setId(UUID.randomUUID());
        reviewCase.setApplication(app);
        reviewCase.setStatus(ReviewCaseStatus.WAITING_SUPPLIER_RESPONSE);

        RevampIntegrationRequest request = new RevampIntegrationRequest();
        request.setId(UUID.randomUUID());
        request.setReviewCase(reviewCase);
        request.setStatus(IntegrationRequestStatus.OPEN);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));
        when(integrationRequestRepository.findFirstByReviewCaseApplicationIdAndStatusOrderByCreatedAtDesc(appId, IntegrationRequestStatus.OPEN))
                .thenReturn(request);
        when(applicationRepository.save(any(RevampApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(integrationRequestRepository.save(any(RevampIntegrationRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewCaseRepository.save(any(RevampReviewCase.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampApplicationSummaryDto dto = applicationService.answerIntegration(appId, userId);

        assertEquals("UNDER_REVIEW", dto.status());
        assertEquals(IntegrationRequestStatus.ANSWERED, request.getStatus());
        assertNotNull(request.getSupplierRespondedAt());
        assertEquals(ReviewCaseStatus.IN_PROGRESS, reviewCase.getStatus());
        verify(auditService).append(any(RevampAuditEventInputDto.class));
        verify(protocolCodeService, never()).nextProtocolCode(any());
    }

    @Test
    void submitThrowsIfApplicationMissing() {
        UUID appId = UUID.randomUUID();
        when(applicationRepository.findById(appId)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> applicationService.submit(appId));
    }

    @Test
    void saveLatestSectionUsesValidatorAndPersistsNormalizedPayload() throws Exception {
        UUID appId = UUID.randomUUID();
        User user = new User();
        user.setId(UUID.randomUUID());

        RevampApplication app = new RevampApplication();
        app.setId(appId);
        app.setApplicantUser(user);
        app.setRegistryType(RegistryType.ALBO_B);
        app.setSourceChannel(SourceChannel.PUBLIC);
        app.setStatus(ApplicationStatus.DRAFT);
        app.setCurrentRevision(1);

        JsonNode normalized = objectMapper.readTree("""
            {"employeeRange":"E_10_49","atecoPrimary":"85.59","operatingRegions":"Lombardia"}
            """);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));
        when(applicationSectionRepository.findByApplicationIdAndSectionKeyAndIsLatestTrue(appId, "S2"))
                .thenReturn(Optional.empty());
        when(applicationSectionRepository.findTopByApplicationIdAndSectionKeyOrderBySectionVersionDesc(appId, "S2"))
                .thenReturn(Optional.empty());
        when(sectionPayloadValidator.validateAndNormalize(eq(RegistryType.ALBO_B), eq("S2"), any(JsonNode.class), eq(true), any()))
                .thenReturn(normalized);
        when(attachmentService.syncAndEnrich(app, "S2", normalized)).thenReturn(normalized);
        when(applicationSectionRepository.save(any(RevampApplicationSection.class))).thenAnswer(invocation -> {
            RevampApplicationSection section = invocation.getArgument(0);
            section.setId(UUID.randomUUID());
            return section;
        });

        String payload = "{\"employeeRange\":\"16_50\",\"atecoPrimary\":\"85.59\",\"operatingRegions\":\"Lombardia\"}";
        var snapshot = applicationService.saveLatestSection(appId, "S2", payload, true);

        assertNotNull(snapshot.id());
        assertEquals("S2", snapshot.sectionKey());
        assertEquals(1, snapshot.sectionVersion());
        assertNotNull(snapshot.payloadJson());
        assertTrue(snapshot.payloadJson().contains("\"E_10_49\""));
        verify(sectionPayloadValidator).validateAndNormalize(eq(RegistryType.ALBO_B), eq("S2"), any(JsonNode.class), eq(true), any());
    }

    @Test
    void saveLatestSectionRejectsDuplicateAlboATaxCode() throws Exception {
        UUID appId = UUID.randomUUID();
        RevampApplication app = draftApplication(appId, RegistryType.ALBO_A);
        JsonNode normalized = objectMapper.readTree("""
            {"firstName":"Mario","lastName":"Rossi","taxCode":" rssmra80a01f205x "}
            """);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));
        when(applicationSectionRepository.findByApplicationIdAndSectionKeyAndIsLatestTrue(appId, "S1"))
                .thenReturn(Optional.empty());
        when(applicationSectionRepository.findTopByApplicationIdAndSectionKeyOrderBySectionVersionDesc(appId, "S1"))
                .thenReturn(Optional.empty());
        when(sectionPayloadValidator.validateAndNormalize(eq(RegistryType.ALBO_A), eq("S1"), any(JsonNode.class), eq(true), any()))
                .thenReturn(normalized);
        when(applicationRepository.existsBlockingIdentity(
                eq(RegistryType.ALBO_A),
                eq("TAX_CODE"),
                eq("RSSMRA80A01F205X"),
                any(),
                eq(appId)
        )).thenReturn(true);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                applicationService.saveLatestSection(appId, "S1", normalized.toString(), true)
        );

        assertEquals("validation.duplicate.taxId", ex.getMessage());
    }

    @Test
    void saveLatestSectionRejectsDuplicateAlboBVatNumber() throws Exception {
        UUID appId = UUID.randomUUID();
        RevampApplication app = draftApplication(appId, RegistryType.ALBO_B);
        JsonNode normalized = objectMapper.readTree("""
            {"companyName":"Acme","vatNumber":" 12345678901 "}
            """);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));
        when(applicationSectionRepository.findByApplicationIdAndSectionKeyAndIsLatestTrue(appId, "S1"))
                .thenReturn(Optional.empty());
        when(applicationSectionRepository.findTopByApplicationIdAndSectionKeyOrderBySectionVersionDesc(appId, "S1"))
                .thenReturn(Optional.empty());
        when(sectionPayloadValidator.validateAndNormalize(eq(RegistryType.ALBO_B), eq("S1"), any(JsonNode.class), eq(true), any()))
                .thenReturn(normalized);
        when(applicationRepository.existsBlockingIdentity(
                eq(RegistryType.ALBO_B),
                eq("VAT_NUMBER"),
                eq("12345678901"),
                any(),
                eq(appId)
        )).thenReturn(true);

        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                applicationService.saveLatestSection(appId, "S1", normalized.toString(), true)
        );

        assertEquals("validation.duplicate.vatNumber", ex.getMessage());
    }

    @Test
    void checkIdentityAvailabilityExcludesCurrentApplication() {
        UUID appId = UUID.randomUUID();
        RevampApplication app = draftApplication(appId, RegistryType.ALBO_A);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));
        when(applicationRepository.existsBlockingIdentity(
                eq(RegistryType.ALBO_A),
                eq("TAX_CODE"),
                eq("RSSMRA80A01F205X"),
                any(),
                eq(appId)
        )).thenReturn(false);

        var result = applicationService.checkIdentityAvailability(appId, "taxCode", " rssmra80a01f205x ");

        assertTrue(result.available());
        assertEquals("taxCode", result.field());
    }

    @Test
    void deleteOwnDraftDeletesOnlyOwnedDraftDependencies() {
        UUID appId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        RevampApplication app = draftApplication(appId, RegistryType.ALBO_B);
        app.setApplicantUser(user);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));

        applicationService.deleteOwnDraft(appId, userId);

        verify(otpChallengeRepository).deleteByApplicationId(appId);
        verify(applicationAttachmentRepository).deleteByApplicationId(appId);
        verify(applicationSectionRepository).deleteByApplicationId(appId);
        verify(applicationRepository).delete(app);
    }

    @Test
    void deleteOwnDraftRejectsOtherSupplierDraft() {
        UUID appId = UUID.randomUUID();
        RevampApplication app = draftApplication(appId, RegistryType.ALBO_A);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));

        assertThrows(AccessDeniedException.class, () -> applicationService.deleteOwnDraft(appId, UUID.randomUUID()));
        verify(applicationRepository, never()).delete(any(RevampApplication.class));
    }

    @Test
    void deleteStaleDraftsDeletesDraftsOlderThanCutoff() {
        RevampApplication staleA = draftApplication(UUID.randomUUID(), RegistryType.ALBO_A);
        RevampApplication staleB = draftApplication(UUID.randomUUID(), RegistryType.ALBO_B);
        when(applicationRepository.findByStatusAndUpdatedAtBefore(eq(ApplicationStatus.DRAFT), any(LocalDateTime.class)))
                .thenReturn(List.of(staleA, staleB));

        int deleted = applicationService.deleteStaleDraftsOlderThanDays(30);

        assertEquals(2, deleted);
        verify(applicationRepository).delete(staleA);
        verify(applicationRepository).delete(staleB);
    }

    private RevampApplication draftApplication(UUID appId, RegistryType registryType) {
        User user = new User();
        user.setId(UUID.randomUUID());

        RevampApplication app = new RevampApplication();
        app.setId(appId);
        app.setApplicantUser(user);
        app.setRegistryType(registryType);
        app.setSourceChannel(SourceChannel.PUBLIC);
        app.setStatus(ApplicationStatus.DRAFT);
        app.setCurrentRevision(1);
        return app;
    }
}

