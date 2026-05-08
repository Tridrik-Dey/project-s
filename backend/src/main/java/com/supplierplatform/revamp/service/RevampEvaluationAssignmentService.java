package com.supplierplatform.revamp.service;

import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampEvaluationAssignmentDto;
import com.supplierplatform.revamp.dto.RevampEvaluationAssignmentRowDto;
import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.enums.RegistryProfileStatus;
import com.supplierplatform.revamp.model.RevampEvaluation;
import com.supplierplatform.revamp.model.RevampSupplierEvaluatorAssignment;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfile;
import com.supplierplatform.revamp.repository.RevampEvaluationRepository;
import com.supplierplatform.revamp.repository.RevampSupplierEvaluatorAssignmentRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampEvaluationAssignmentService {

    private final RevampSupplierEvaluatorAssignmentRepository assignmentRepository;
    private final RevampSupplierRegistryProfileRepository supplierRegistryProfileRepository;
    private final RevampEvaluationRepository evaluationRepository;
    private final UserRepository userRepository;
    private final RevampGovernanceAuthorizationService governanceAuthorizationService;

    @Transactional
    public RevampEvaluationAssignmentDto selfAssign(UUID supplierRegistryProfileId, UUID viewerUserId) {
        governanceAuthorizationService.requireAnyRole(viewerUserId, AdminRole.VIEWER);

        RevampSupplierRegistryProfile profile = supplierRegistryProfileRepository.findById(supplierRegistryProfileId)
                .orElseThrow(() -> new EntityNotFoundException("RevampSupplierRegistryProfile", supplierRegistryProfileId));
        if (profile.getStatus() != RegistryProfileStatus.APPROVED) {
            throw new IllegalStateException("Supplier must be APPROVED to be taken for evaluation");
        }

        Optional<RevampSupplierEvaluatorAssignment> existing =
                assignmentRepository.findBySupplierRegistryProfileIdAndAssignedEvaluatorUserId(
                        supplierRegistryProfileId, viewerUserId);
        if (existing.isPresent()) {
            return toDto(existing.get());
        }

        User viewer = userRepository.findById(viewerUserId)
                .orElseThrow(() -> new EntityNotFoundException("User", viewerUserId));

        RevampSupplierEvaluatorAssignment assignment = new RevampSupplierEvaluatorAssignment();
        assignment.setSupplierRegistryProfile(profile);
        assignment.setAssignedEvaluatorUser(viewer);
        return toDto(assignmentRepository.save(assignment));
    }

    @Transactional(readOnly = true)
    public List<RevampEvaluationAssignmentRowDto> listAssignments(UUID actorUserId) {
        AdminRole actorRole = governanceAuthorizationService.requireAnyRole(
                actorUserId,
                AdminRole.SUPER_ADMIN,
                AdminRole.RESPONSABILE_ALBO,
                AdminRole.REVISORE,
                AdminRole.VIEWER
        );

        if (actorRole == AdminRole.VIEWER) {
            // All APPROVED suppliers with this viewer's assignment/evaluation status
            List<RevampSupplierRegistryProfile> profiles =
                    supplierRegistryProfileRepository.findByStatus(RegistryProfileStatus.APPROVED);
            return profiles.stream()
                    .map(profile -> {
                        Optional<RevampSupplierEvaluatorAssignment> assignment =
                                assignmentRepository.findBySupplierRegistryProfileIdAndAssignedEvaluatorUserId(
                                        profile.getId(), actorUserId);
                        Optional<RevampEvaluation> evaluation = assignment.isPresent()
                                ? evaluationRepository.findBySupplierRegistryProfileIdAndEvaluatorUserId(
                                        profile.getId(), actorUserId)
                                : Optional.empty();
                        return toRow(profile, assignment.orElse(null), evaluation.orElse(null));
                    })
                    .sorted(Comparator.comparing(RevampEvaluationAssignmentRowDto::supplierName,
                            Comparator.nullsLast(String::compareToIgnoreCase)))
                    .toList();
        }

        // Non-VIEWER: return all (viewer, supplier) assignment pairs with evaluation status
        return assignmentRepository.findAll().stream()
                .filter(a -> a.getSupplierRegistryProfile() != null && a.getAssignedEvaluatorUser() != null)
                .map(a -> {
                    RevampSupplierRegistryProfile profile = a.getSupplierRegistryProfile();
                    Optional<RevampEvaluation> evaluation =
                            evaluationRepository.findBySupplierRegistryProfileIdAndEvaluatorUserId(
                                    profile.getId(), a.getAssignedEvaluatorUser().getId());
                    return toRow(profile, a, evaluation.orElse(null));
                })
                .sorted(Comparator.comparing(RevampEvaluationAssignmentRowDto::supplierName,
                        Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean isAssigned(UUID supplierRegistryProfileId, UUID viewerUserId) {
        return assignmentRepository.existsBySupplierRegistryProfileIdAndAssignedEvaluatorUserId(
                supplierRegistryProfileId, viewerUserId);
    }

    @Transactional(readOnly = true)
    public void requireAssignedViewer(UUID supplierRegistryProfileId, UUID viewerUserId) {
        if (!isAssigned(supplierRegistryProfileId, viewerUserId)) {
            throw new AccessDeniedException("Viewer is not assigned to this supplier. Use 'Prendi in carico' first.");
        }
    }

    private RevampEvaluationAssignmentDto toDto(RevampSupplierEvaluatorAssignment assignment) {
        User evaluator = assignment.getAssignedEvaluatorUser();
        return new RevampEvaluationAssignmentDto(
                assignment.getId(),
                assignment.getSupplierRegistryProfile() != null ? assignment.getSupplierRegistryProfile().getId() : null,
                evaluator != null ? evaluator.getId() : null,
                evaluator != null ? evaluator.getEmail() : null,
                assignment.getAssignedAt()
        );
    }

    private RevampEvaluationAssignmentRowDto toRow(
            RevampSupplierRegistryProfile profile,
            RevampSupplierEvaluatorAssignment assignment,
            RevampEvaluation evaluation
    ) {
        String supplierName = profile.getDisplayName() != null
                ? profile.getDisplayName()
                : (profile.getSupplierUser() != null ? profile.getSupplierUser().getEmail() : null);
        String supplierType = profile.getRegistryType() != null ? profile.getRegistryType().name() : null;

        if (assignment == null) {
            return new RevampEvaluationAssignmentRowDto(
                    null, profile.getId(), supplierName, supplierType,
                    null, null, null,
                    null, null, null
            );
        }

        User evaluator = assignment.getAssignedEvaluatorUser();
        return new RevampEvaluationAssignmentRowDto(
                assignment.getId(),
                profile.getId(),
                supplierName,
                supplierType,
                evaluator != null ? evaluator.getId() : null,
                evaluator != null ? evaluator.getEmail() : null,
                assignment.getAssignedAt(),
                evaluation != null ? evaluation.getId() : null,
                evaluation != null ? evaluation.getOverallScore() : null,
                evaluation != null ? evaluation.getCreatedAt() : null
        );
    }
}
