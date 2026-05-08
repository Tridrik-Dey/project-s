package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.model.RevampEvaluationDimension;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RevampEvaluationDimensionRepository extends JpaRepository<RevampEvaluationDimension, UUID> {
    List<RevampEvaluationDimension> findByEvaluationId(UUID evaluationId);
    List<RevampEvaluationDimension> findByEvaluationIdIn(List<UUID> evaluationIds);

    @Modifying
    @Query("DELETE FROM RevampEvaluationDimension d WHERE d.evaluation.id = :evaluationId")
    void deleteByEvaluationId(@Param("evaluationId") UUID evaluationId);
}
