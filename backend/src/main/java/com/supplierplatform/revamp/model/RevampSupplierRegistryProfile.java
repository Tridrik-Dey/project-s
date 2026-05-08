package com.supplierplatform.revamp.model;
import com.supplierplatform.revamp.schema.RevampTableNames;

import com.supplierplatform.revamp.enums.RegistryProfileStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = RevampTableNames.SUPPLIER_REGISTRY_PROFILES)
@EntityListeners(AuditingEntityListener.class)
public class RevampSupplierRegistryProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", unique = true)
    private RevampApplication application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_user_id", nullable = false)
    private User supplierUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "registry_type", nullable = false, length = 20)
    private RegistryType registryType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private RegistryProfileStatus status;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "public_summary", columnDefinition = "TEXT")
    private String publicSummary;

    @Column(name = "aggregate_score", precision = 5, scale = 2)
    private BigDecimal aggregateScore;

    @Column(name = "is_visible", nullable = false)
    private Boolean isVisible = false;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}



