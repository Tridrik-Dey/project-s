package com.supplierplatform.revamp.model;
import com.fasterxml.jackson.databind.JsonNode;
import com.supplierplatform.revamp.schema.RevampTableNames;

import com.supplierplatform.revamp.enums.IntegrationRequestStatus;
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
@Table(name = RevampTableNames.INTEGRATION_REQUESTS)
@EntityListeners(AuditingEntityListener.class)
public class RevampIntegrationRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "review_case_id", nullable = false)
    private RevampReviewCase reviewCase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_user_id")
    private User requestedByUser;

    @Column(name = "due_at", nullable = false)
    private LocalDateTime dueAt;

    @Column(name = "request_message", nullable = false, columnDefinition = "TEXT")
    private String requestMessage;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "requested_items_json", nullable = false, columnDefinition = "jsonb")
    private JsonNode requestedItemsJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "supplier_response_json", columnDefinition = "jsonb")
    private JsonNode supplierResponseJson;

    @Column(name = "supplier_responded_at")
    private LocalDateTime supplierRespondedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private IntegrationRequestStatus status;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}



