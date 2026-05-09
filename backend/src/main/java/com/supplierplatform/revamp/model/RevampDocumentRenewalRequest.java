package com.supplierplatform.revamp.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.supplierplatform.revamp.enums.DocumentRenewalRequestStatus;
import com.supplierplatform.revamp.schema.RevampTableNames;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = RevampTableNames.DOCUMENT_RENEWAL_REQUESTS)
@EntityListeners(AuditingEntityListener.class)
public class RevampDocumentRenewalRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private RevampApplication application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "review_case_id")
    private RevampReviewCase reviewCase;

    @Column(name = "section_key", nullable = false, length = 16)
    private String sectionKey;

    @Column(name = "batch_id", nullable = false, length = 128)
    private String batchId;

    @Column(name = "document_type", nullable = false, length = 64)
    private String documentType;

    @Column(name = "document_label", nullable = false, length = 255)
    private String documentLabel;

    @Column(name = "integration_item_code", nullable = false, length = 96)
    private String integrationItemCode;

    @Column(name = "certification_key", length = 64)
    private String certificationKey;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private DocumentRenewalRequestStatus status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "old_attachment_json", columnDefinition = "jsonb")
    private JsonNode oldAttachmentJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_attachment_json", columnDefinition = "jsonb")
    private JsonNode newAttachmentJson;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
