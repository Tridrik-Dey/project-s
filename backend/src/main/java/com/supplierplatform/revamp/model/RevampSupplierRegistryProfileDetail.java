package com.supplierplatform.revamp.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.supplierplatform.revamp.schema.RevampTableNames;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = RevampTableNames.SUPPLIER_REGISTRY_PROFILE_DETAILS)
@EntityListeners(AuditingEntityListener.class)
public class RevampSupplierRegistryProfileDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "profile_id", nullable = false, unique = true)
    private RevampSupplierRegistryProfile profile;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "projected_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode projectedJson;

    @Column(name = "search_ateco_primary")
    private String searchAtecoPrimary;

    @Column(name = "search_regions_csv", columnDefinition = "TEXT")
    private String searchRegionsCsv;

    @Column(name = "search_service_categories_csv", columnDefinition = "TEXT")
    private String searchServiceCategoriesCsv;

    @Column(name = "search_certifications_csv", columnDefinition = "TEXT")
    private String searchCertificationsCsv;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
