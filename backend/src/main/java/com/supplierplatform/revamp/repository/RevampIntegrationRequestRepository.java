package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.IntegrationRequestStatus;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RevampIntegrationRequestRepository extends JpaRepository<RevampIntegrationRequest, UUID> {
    List<RevampIntegrationRequest> findByReviewCaseIdOrderByCreatedAtDesc(UUID reviewCaseId);
    List<RevampIntegrationRequest> findByStatus(IntegrationRequestStatus status);
    RevampIntegrationRequest findFirstByReviewCaseIdAndStatusOrderByCreatedAtDesc(UUID reviewCaseId, IntegrationRequestStatus status);
    RevampIntegrationRequest findFirstByReviewCaseIdOrderByCreatedAtDesc(UUID reviewCaseId);
    RevampIntegrationRequest findFirstByReviewCaseApplicationIdAndStatusOrderByCreatedAtDesc(UUID applicationId, IntegrationRequestStatus status);
}
