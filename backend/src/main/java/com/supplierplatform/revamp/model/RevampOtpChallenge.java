package com.supplierplatform.revamp.model;
import com.supplierplatform.revamp.schema.RevampTableNames;

import com.supplierplatform.revamp.enums.OtpChallengeStatus;
import com.supplierplatform.revamp.enums.OtpChallengeType;
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
@Table(name = RevampTableNames.OTP_CHALLENGES)
@EntityListeners(AuditingEntityListener.class)
public class RevampOtpChallenge {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    private RevampApplication application;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "challenge_type", nullable = false, length = 32)
    private OtpChallengeType challengeType;

    @Column(name = "target_email")
    private String targetEmail;

    @Column(name = "otp_hash", nullable = false)
    private String otpHash;

    @Column(name = "attempts", nullable = false)
    private Integer attempts = 0;

    @Column(name = "max_attempts", nullable = false)
    private Integer maxAttempts = 5;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private OtpChallengeStatus status;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}



