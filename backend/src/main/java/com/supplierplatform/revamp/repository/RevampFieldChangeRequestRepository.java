package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.FieldChangeRequestStatus;
import com.supplierplatform.revamp.model.RevampFieldChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevampFieldChangeRequestRepository extends JpaRepository<RevampFieldChangeRequest, UUID> {

    List<RevampFieldChangeRequest> findByApplicationIdOrderByCreatedAtDesc(UUID applicationId);

    Optional<RevampFieldChangeRequest> findFirstByApplicationIdAndSectionKeyAndStatusIn(
            UUID applicationId, String sectionKey, List<FieldChangeRequestStatus> statuses);

    Optional<RevampFieldChangeRequest> findByReviewCaseId(UUID reviewCaseId);

    List<RevampFieldChangeRequest> findByApplicationIdAndStatusIn(
            UUID applicationId, List<FieldChangeRequestStatus> statuses);

    List<RevampFieldChangeRequest> findByStatusOrderByCreatedAtDesc(FieldChangeRequestStatus status);
}
