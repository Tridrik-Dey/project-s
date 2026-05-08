package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.OtpChallengeStatus;
import com.supplierplatform.revamp.enums.OtpChallengeType;
import com.supplierplatform.revamp.model.RevampOtpChallenge;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RevampOtpChallengeRepository extends JpaRepository<RevampOtpChallenge, UUID> {
    List<RevampOtpChallenge> findByUserIdAndChallengeTypeAndStatusOrderByCreatedAtDesc(
            UUID userId,
            OtpChallengeType challengeType,
            OtpChallengeStatus status
    );
    void deleteByApplicationId(UUID applicationId);
}
