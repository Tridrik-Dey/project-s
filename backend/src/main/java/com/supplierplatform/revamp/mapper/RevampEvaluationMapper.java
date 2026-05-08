package com.supplierplatform.revamp.mapper;

import com.supplierplatform.revamp.dto.RevampEvaluationSummaryDto;
import com.supplierplatform.revamp.model.RevampEvaluation;
import org.springframework.stereotype.Component;

@Component
public class RevampEvaluationMapper {

    public RevampEvaluationSummaryDto toSummary(RevampEvaluation evaluation) {
        return new RevampEvaluationSummaryDto(
                evaluation.getId(),
                evaluation.getSupplierRegistryProfile() != null ? evaluation.getSupplierRegistryProfile().getId() : null,
                evaluation.getEvaluatorUser() != null ? evaluation.getEvaluatorUser().getId() : null,
                evaluation.getEvaluatorUser() != null ? evaluation.getEvaluatorUser().getEmail() : null,
                evaluation.getOverallScore() != null ? evaluation.getOverallScore() : 0,
                evaluation.getCreatedAt()
        );
    }
}
