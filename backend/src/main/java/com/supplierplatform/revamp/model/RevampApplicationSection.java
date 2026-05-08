package com.supplierplatform.revamp.model;
import com.fasterxml.jackson.databind.JsonNode;
import com.supplierplatform.revamp.schema.RevampTableNames;

import jakarta.persistence.*;
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
@Table(
        name = RevampTableNames.APPLICATION_SECTIONS,
        uniqueConstraints = @UniqueConstraint(
                name = "uk_application_section_version",
                columnNames = {"application_id", "section_key", "section_version"}
        )
)
@EntityListeners(AuditingEntityListener.class)
public class RevampApplicationSection {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private RevampApplication application;

    @Column(name = "section_key", nullable = false, length = 32)
    private String sectionKey;

    @Column(name = "section_version", nullable = false)
    private Integer sectionVersion = 1;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode payloadJson;

    @Column(name = "is_latest", nullable = false)
    private Boolean isLatest = true;

    @Column(name = "completed", nullable = false)
    private Boolean completed = false;

    @Column(name = "validated_at")
    private LocalDateTime validatedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}



