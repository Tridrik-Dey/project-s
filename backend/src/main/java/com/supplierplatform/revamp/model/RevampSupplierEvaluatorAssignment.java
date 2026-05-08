package com.supplierplatform.revamp.model;

import com.supplierplatform.revamp.schema.RevampTableNames;
import com.supplierplatform.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = RevampTableNames.SUPPLIER_EVALUATOR_ASSIGNMENTS)
@EntityListeners(AuditingEntityListener.class)
public class RevampSupplierEvaluatorAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_registry_profile_id", nullable = false)
    private RevampSupplierRegistryProfile supplierRegistryProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_evaluator_user_id", nullable = false)
    private User assignedEvaluatorUser;

    @CreatedDate
    @Column(name = "assigned_at", nullable = false, updatable = false)
    private LocalDateTime assignedAt;
}
