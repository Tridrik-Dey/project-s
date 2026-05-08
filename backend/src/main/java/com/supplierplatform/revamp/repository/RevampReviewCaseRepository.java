package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.ReviewCaseStatus;
import com.supplierplatform.revamp.model.RevampReviewCase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RevampReviewCaseRepository extends JpaRepository<RevampReviewCase, UUID> {
    List<RevampReviewCase> findByStatusOrderByCreatedAtAsc(ReviewCaseStatus status);
    List<RevampReviewCase> findByApplicationIdOrderByCreatedAtDesc(UUID applicationId);
    List<RevampReviewCase> findByStatusNotInOrderByUpdatedAtDesc(List<ReviewCaseStatus> statuses);
    List<RevampReviewCase> findByStatusInOrderByUpdatedAtDesc(List<ReviewCaseStatus> statuses);
    List<RevampReviewCase> findByApplicationIdAndStatusNotInOrderByUpdatedAtDesc(UUID applicationId, List<ReviewCaseStatus> statuses);
}
