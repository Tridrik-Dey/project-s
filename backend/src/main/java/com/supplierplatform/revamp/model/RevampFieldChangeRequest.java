package com.supplierplatform.revamp.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.supplierplatform.revamp.enums.FieldChangeRequestStatus;
import com.supplierplatform.revamp.schema.RevampTableNames;
import com.supplierplatform.user.User;
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
@Table(name = RevampTableNames.FIELD_CHANGE_REQUESTS)
@EntityListeners(AuditingEntityListener.class)
public class RevampFieldChangeRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private RevampApplication application;

    // Which section the supplier wants to change (e.g. "S1", "S2")
    @Column(name = "section_key", nullable = false, length = 32)
    private String sectionKey;

    @Column(name = "supplier_message", nullable = false, columnDefinition = "TEXT")
    private String supplierMessage;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private FieldChangeRequestStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unlocked_by_user_id")
    private User unlockedByUser;

    @Column(name = "unlocked_at")
    private LocalDateTime unlockedAt;

    @Column(name = "admin_note", columnDefinition = "TEXT")
    private String adminNote;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    // Audit trail: snapshot of section data before the change
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "before_value_json", columnDefinition = "jsonb")
    private JsonNode beforeValueJson;

    // Audit trail: snapshot of section data after supplier submitted
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "after_value_json", columnDefinition = "jsonb")
    private JsonNode afterValueJson;

    // Created when supplier submits — links to the review pipeline
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "review_case_id")
    private RevampReviewCase reviewCase;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
