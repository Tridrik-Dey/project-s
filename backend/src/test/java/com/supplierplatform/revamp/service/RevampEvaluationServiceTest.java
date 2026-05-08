package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.dto.RevampEvaluationSummaryDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.mapper.RevampEvaluationMapper;
import com.supplierplatform.revamp.model.RevampEvaluation;
import com.supplierplatform.revamp.model.RevampEvaluationDimension;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfile;
import com.supplierplatform.revamp.repository.RevampEvaluationDimensionRepository;
import com.supplierplatform.revamp.repository.RevampEvaluationRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RevampEvaluationServiceTest {

    @Mock
    private RevampEvaluationRepository evaluationRepository;
    @Mock
    private RevampEvaluationDimensionRepository evaluationDimensionRepository;
    @Mock
    private RevampSupplierRegistryProfileRepository supplierRegistryProfileRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private RevampEvaluationAssignmentService evaluationAssignmentService;
    @Mock
    private RevampGovernanceAuthorizationService governanceAuthorizationService;
    @Mock
    private RevampAuditService auditService;
    @Spy
    private RevampEvaluationMapper evaluationMapper = new RevampEvaluationMapper();

    @InjectMocks
    private RevampEvaluationService evaluationService;

    @Test
    void upsertEvaluationCreatesNewEvaluationWithDimensions() {
        UUID profileId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();

        RevampSupplierRegistryProfile profile = new RevampSupplierRegistryProfile();
        profile.setId(profileId);
        User viewer = new User();
        viewer.setId(viewerId);

        when(governanceAuthorizationService.requireAnyRole(viewerId, AdminRole.VIEWER))
                .thenReturn(AdminRole.VIEWER);
        when(evaluationRepository.findBySupplierRegistryProfileIdAndEvaluatorUserId(profileId, viewerId))
                .thenReturn(Optional.empty());
        when(supplierRegistryProfileRepository.findById(profileId)).thenReturn(Optional.of(profile));
        when(userRepository.findById(viewerId)).thenReturn(Optional.of(viewer));
        when(evaluationRepository.save(any(RevampEvaluation.class))).thenAnswer(invocation -> {
            RevampEvaluation e = invocation.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });
        when(evaluationDimensionRepository.save(any(RevampEvaluationDimension.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        RevampEvaluationSummaryDto dto = evaluationService.upsertEvaluation(
                profileId,
                viewerId,
                "CONSULTING",
                "2026-03",
                "REF-001",
                (short) 4,
                "Good",
                Map.of("quality", (short) 5, "timeliness", (short) 4)
        );

        assertEquals(profileId, dto.supplierRegistryProfileId());
        assertEquals(viewerId, dto.evaluatorUserId());
        assertEquals(4, dto.overallScore());

        ArgumentCaptor<RevampEvaluationDimension> dimCaptor = ArgumentCaptor.forClass(RevampEvaluationDimension.class);
        verify(evaluationDimensionRepository, org.mockito.Mockito.times(2)).save(dimCaptor.capture());
    }

    @Test
    void upsertEvaluationUpdatesExistingEvaluation() {
        UUID profileId = UUID.randomUUID();
        UUID viewerId = UUID.randomUUID();
        UUID existingId = UUID.randomUUID();

        RevampSupplierRegistryProfile profile = new RevampSupplierRegistryProfile();
        profile.setId(profileId);
        User viewer = new User();
        viewer.setId(viewerId);
        RevampEvaluation existing = new RevampEvaluation();
        existing.setId(existingId);

        when(governanceAuthorizationService.requireAnyRole(viewerId, AdminRole.VIEWER))
                .thenReturn(AdminRole.VIEWER);
        when(evaluationRepository.findBySupplierRegistryProfileIdAndEvaluatorUserId(profileId, viewerId))
                .thenReturn(Optional.of(existing));
        when(supplierRegistryProfileRepository.findById(profileId)).thenReturn(Optional.of(profile));
        when(userRepository.findById(viewerId)).thenReturn(Optional.of(viewer));
        when(evaluationRepository.save(any(RevampEvaluation.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RevampEvaluationSummaryDto dto = evaluationService.upsertEvaluation(
                profileId, viewerId, "CONSULTING", "2026-04", null, (short) 3, null, Map.of()
        );

        assertEquals(existingId, dto.id());
        assertEquals(3, dto.overallScore());
    }
}
