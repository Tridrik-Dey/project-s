package com.supplierplatform.revamp.model;
import com.supplierplatform.revamp.schema.RevampTableNames;

import com.supplierplatform.revamp.enums.AdminRole;
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
@Table(
        name = RevampTableNames.USER_ADMIN_ROLES,
        uniqueConstraints = @UniqueConstraint(
                name = "uk_user_admin_single_role",
                columnNames = {"user_id"}
        )
)
@EntityListeners(AuditingEntityListener.class)
public class RevampUserAdminRole {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "admin_role", nullable = false, length = 50)
    private AdminRole adminRole;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdByUser;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}



