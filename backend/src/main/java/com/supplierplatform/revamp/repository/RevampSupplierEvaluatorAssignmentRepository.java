package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.model.RevampSupplierEvaluatorAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevampSupplierEvaluatorAssignmentRepository extends JpaRepository<RevampSupplierEvaluatorAssignment, UUID> {
    Optional<RevampSupplierEvaluatorAssignment> findBySupplierRegistryProfileIdAndAssignedEvaluatorUserId(
            UUID supplierRegistryProfileId, UUID assignedEvaluatorUserId);
    List<RevampSupplierEvaluatorAssignment> findByAssignedEvaluatorUserIdOrderByAssignedAtDesc(UUID assignedEvaluatorUserId);
    List<RevampSupplierEvaluatorAssignment> findBySupplierRegistryProfileId(UUID supplierRegistryProfileId);
    boolean existsBySupplierRegistryProfileIdAndAssignedEvaluatorUserId(UUID supplierRegistryProfileId, UUID assignedEvaluatorUserId);
}
