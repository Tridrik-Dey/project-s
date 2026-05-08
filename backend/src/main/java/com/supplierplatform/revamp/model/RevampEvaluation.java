package com.supplierplatform.revamp.model;

import com.supplierplatform.revamp.schema.RevampTableNames;
import com.supplierplatform.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(
        name = RevampTableNames.EVALUATIONS,
        uniqueConstraints = @UniqueConstraint(
                name = "uk_evaluation_supplier_evaluator",
                columnNames = {"supplier_registry_profile_id", "evaluator_user_id"}
        )
)
@EntityListeners(AuditingEntityListener.class)
public class RevampEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_registry_profile_id", nullable = false)
    private RevampSupplierRegistryProfile supplierRegistryProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "evaluator_user_id", nullable = false)
    private User evaluatorUser;

    @Column(name = "collaboration_type", nullable = false)
    private String collaborationType;

    @Column(name = "collaboration_period", nullable = false)
    private String collaborationPeriod;

    @Column(name = "reference_code")
    private String referenceCode;

    @Column(name = "overall_score", nullable = false)
    private Short overallScore;

    @Column(name = "comment", columnDefinition = "TEXT")
    private String comment;

    // Managed manually so re-evaluation resets the timestamp
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
