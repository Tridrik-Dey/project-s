package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.model.RevampEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevampEvaluationRepository extends JpaRepository<RevampEvaluation, UUID> {
    List<RevampEvaluation> findAllByOrderByCreatedAtDesc();
    List<RevampEvaluation> findBySupplierRegistryProfileIdOrderByCreatedAtDesc(UUID supplierRegistryProfileId);
    List<RevampEvaluation> findBySupplierRegistryProfileIdInOrderByCreatedAtDesc(List<UUID> supplierRegistryProfileIds);
    Optional<RevampEvaluation> findBySupplierRegistryProfileIdAndEvaluatorUserId(
            UUID supplierRegistryProfileId,
            UUID evaluatorUserId
    );
}
