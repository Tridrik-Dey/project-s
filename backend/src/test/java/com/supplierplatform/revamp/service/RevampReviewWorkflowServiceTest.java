package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.revamp.dto.RevampReviewCaseSummaryDto;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.IntegrationRequestStatus;
import com.supplierplatform.revamp.enums.ReviewCaseStatus;
import com.supplierplatform.revamp.enums.ReviewDecision;
import com.supplierplatform.revamp.mapper.RevampReviewCaseMapper;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import com.supplierplatform.revamp.model.RevampReviewCase;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampIntegrationRequestRepository;
import com.supplierplatform.revamp.repository.RevampReviewCaseRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevampReviewWorkflowServiceTest {

    @Mock
    private RevampReviewCaseRepository reviewCaseRepository;
    @Mock
    private RevampApplicationRepository applicationRepository;
    @Mock
    private RevampIntegrationRequestRepository integrationRequestRepository;
    @Mock
    private UserRepository userRepository;
    @Spy
    private RevampReviewCaseMapper reviewCaseMapper = new RevampReviewCaseMapper();
    @Mock
    private RevampAuditService auditService;
    @Mock
    private RevampProfileProjectionService profileProjectionService;
    @Mock
    private RevampIntegrationRequestMailService integrationRequestMailService;
    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private RevampReviewWorkflowService reviewWorkflowService;

    @Test
    void requestIntegrationMovesStatusesAndStoresRequest() {
        UUID reviewCaseId = UUID.randomUUID();
        UUID requesterId = UUID.randomUUID();

        RevampApplication app = new RevampApplication();
        app.setId(UUID.randomUUID());
        app.setStatus(ApplicationStatus.UNDER_REVIEW);

        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setId(reviewCaseId);
        reviewCase.setApplication(app);
        reviewCase.setStatus(ReviewCaseStatus.IN_PROGRESS);
        reviewCase.setVerifiedAt(LocalDateTime.now());

        User requester = new User();
        requester.setId(requesterId);

        when(reviewCaseRepository.findById(reviewCaseId)).thenReturn(Optional.of(reviewCase));
        when(userRepository.findById(requesterId)).thenReturn(Optional.of(requester));
        when(integrationRequestRepository.save(any(RevampIntegrationRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewCaseRepository.save(any(RevampReviewCase.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(applicationRepository.save(any(RevampApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampReviewCaseSummaryDto dto = reviewWorkflowService.requestIntegration(
                reviewCaseId,
                requesterId,
                LocalDateTime.now().plusDays(7),
                "Missing DURC",
                "[\"durc\"]"
        );

        assertEquals("WAITING_SUPPLIER_RESPONSE", dto.status());
        assertEquals(ApplicationStatus.INTEGRATION_REQUIRED, app.getStatus());

        ArgumentCaptor<RevampIntegrationRequest> captor = ArgumentCaptor.forClass(RevampIntegrationRequest.class);
        verify(integrationRequestRepository).save(captor.capture());
        assertEquals(IntegrationRequestStatus.OPEN, captor.getValue().getStatus());
        verify(auditService).append(any(RevampAuditEventInputDto.class));
        verify(integrationRequestMailService).sendIntegrationRequestNotice(app, captor.getValue());
    }

    @Test
    void decideApprovedUpdatesApplicationAndReviewCase() {
        UUID reviewCaseId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();

        RevampApplication app = new RevampApplication();
        app.setId(UUID.randomUUID());
        app.setStatus(ApplicationStatus.UNDER_REVIEW);

        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setId(reviewCaseId);
        reviewCase.setApplication(app);
        reviewCase.setStatus(ReviewCaseStatus.IN_PROGRESS);
        reviewCase.setVerifiedAt(LocalDateTime.now());

        User actor = new User();
        actor.setId(actorId);

        when(reviewCaseRepository.findById(reviewCaseId)).thenReturn(Optional.of(reviewCase));
        when(userRepository.findById(actorId)).thenReturn(Optional.of(actor));
        when(applicationRepository.save(any(RevampApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewCaseRepository.save(any(RevampReviewCase.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampReviewCaseSummaryDto dto = reviewWorkflowService.decide(
                reviewCaseId,
                ReviewDecision.APPROVED,
                "All good",
                actorId
        );

        assertEquals("DECIDED", dto.status());
        assertEquals("APPROVED", dto.decision());
        assertEquals(ApplicationStatus.APPROVED, app.getStatus());
        assertNotNull(app.getApprovedAt());
        verify(profileProjectionService).projectApprovedApplication(app.getId());
        verify(auditService).append(any(RevampAuditEventInputDto.class));
    }

    @Test
    void decideIsBlockedWhileIntegrationRequestIsOpen() {
        UUID reviewCaseId = UUID.randomUUID();

        RevampApplication app = new RevampApplication();
        app.setId(UUID.randomUUID());
        app.setStatus(ApplicationStatus.INTEGRATION_REQUIRED);

        RevampReviewCase reviewCase = new RevampReviewCase();
        reviewCase.setId(reviewCaseId);
        reviewCase.setApplication(app);
        reviewCase.setStatus(ReviewCaseStatus.WAITING_SUPPLIER_RESPONSE);

        when(reviewCaseRepository.findById(reviewCaseId)).thenReturn(Optional.of(reviewCase));

        assertThrows(IllegalStateException.class, () -> reviewWorkflowService.decide(
                reviewCaseId,
                ReviewDecision.APPROVED,
                "ok",
                null
        ));
    }

    @Test
    void openCaseReusesExistingActiveCaseForApplication() {
        UUID appId = UUID.randomUUID();
        UUID reviewerId = UUID.randomUUID();

        RevampApplication app = new RevampApplication();
        app.setId(appId);
        app.setStatus(ApplicationStatus.DRAFT);

        RevampReviewCase existing = new RevampReviewCase();
        existing.setId(UUID.randomUUID());
        existing.setApplication(app);
        existing.setStatus(ReviewCaseStatus.PENDING_ASSIGNMENT);
        existing.setCreatedAt(LocalDateTime.now().minusDays(1));
        existing.setUpdatedAt(LocalDateTime.now().minusHours(3));

        User reviewer = new User();
        reviewer.setId(reviewerId);

        when(applicationRepository.findById(appId)).thenReturn(Optional.of(app));
        when(reviewCaseRepository.findByApplicationIdAndStatusNotInOrderByUpdatedAtDesc(eq(appId), anyList()))
                .thenReturn(List.of(existing));
        when(userRepository.findById(reviewerId)).thenReturn(Optional.of(reviewer));
        when(applicationRepository.save(any(RevampApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reviewCaseRepository.save(any(RevampReviewCase.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampReviewCaseSummaryDto dto = reviewWorkflowService.openCase(appId, reviewerId, LocalDateTime.now().plusDays(2));

        assertEquals(existing.getId(), dto.id());
        assertEquals("IN_PROGRESS", dto.status());
        assertEquals(reviewerId, dto.assignedToUserId());
    }

    @Test
    void getQueueReturnsOnlyLatestActiveCasePerApplication() {
        UUID appId = UUID.randomUUID();

        RevampApplication app = new RevampApplication();
        app.setId(appId);

        RevampReviewCase older = new RevampReviewCase();
        older.setId(UUID.randomUUID());
        older.setApplication(app);
        older.setStatus(ReviewCaseStatus.IN_PROGRESS);
        older.setUpdatedAt(LocalDateTime.now().minusDays(2));
        older.setCreatedAt(LocalDateTime.now().minusDays(2));

        RevampReviewCase newer = new RevampReviewCase();
        newer.setId(UUID.randomUUID());
        newer.setApplication(app);
        newer.setStatus(ReviewCaseStatus.READY_FOR_DECISION);
        newer.setUpdatedAt(LocalDateTime.now().minusHours(1));
        newer.setCreatedAt(LocalDateTime.now().minusHours(2));

        when(reviewCaseRepository.findByStatusNotInOrderByUpdatedAtDesc(anyList())).thenReturn(List.of(newer, older));

        List<RevampReviewCaseSummaryDto> queue = reviewWorkflowService.getQueue();

        assertEquals(1, queue.size());
        assertEquals(newer.getId(), queue.get(0).id());
        assertEquals("READY_FOR_DECISION", queue.get(0).status());
    }
}

