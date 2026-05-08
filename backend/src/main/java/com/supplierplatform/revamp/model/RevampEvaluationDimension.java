package com.supplierplatform.revamp.model;
import com.supplierplatform.revamp.schema.RevampTableNames;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
@Entity
@Table(
        name = RevampTableNames.EVALUATION_DIMENSIONS,
        uniqueConstraints = @UniqueConstraint(
                name = "uk_evaluation_dimension_key",
                columnNames = {"evaluation_id", "dimension_key"}
        )
)
public class RevampEvaluationDimension {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluation_id", nullable = false)
    private RevampEvaluation evaluation;

    @Column(name = "dimension_key", nullable = false, length = 50)
    private String dimensionKey;

    @Column(name = "score", nullable = false)
    private Short score;
}



