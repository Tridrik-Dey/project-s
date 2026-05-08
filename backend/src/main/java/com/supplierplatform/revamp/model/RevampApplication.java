package com.supplierplatform.revamp.model;
import com.supplierplatform.revamp.schema.RevampTableNames;

import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.enums.SourceChannel;
import com.supplierplatform.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = RevampTableNames.APPLICATIONS)
@EntityListeners(AuditingEntityListener.class)
public class RevampApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applicant_user_id", nullable = false)
    private User applicantUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invite_id")
    private RevampInvite invite;

    @Enumerated(EnumType.STRING)
    @Column(name = "registry_type", nullable = false, length = 20)
    private RegistryType registryType;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_channel", nullable = false, length = 16)
    private SourceChannel sourceChannel;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ApplicationStatus status;

    @Column(name = "protocol_code", unique = true)
    private String protocolCode;

    @Column(name = "identity_key_type", length = 32)
    private String identityKeyType;

    @Column(name = "identity_value_normalized", length = 128)
    private String identityValueNormalized;

    @Column(name = "current_revision", nullable = false)
    private Integer currentRevision = 1;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "rejected_at")
    private LocalDateTime rejectedAt;

    @Column(name = "suspended_at")
    private LocalDateTime suspendedAt;

    @Column(name = "renewal_due_at")
    private LocalDateTime renewalDueAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}



