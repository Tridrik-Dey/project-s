package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.DocumentRenewalRequestStatus;
import com.supplierplatform.revamp.model.RevampDocumentRenewalRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevampDocumentRenewalRequestRepository extends JpaRepository<RevampDocumentRenewalRequest, UUID> {
    List<RevampDocumentRenewalRequest> findByReviewCaseId(UUID reviewCaseId);
    List<RevampDocumentRenewalRequest> findByApplicationIdOrderByCreatedAtDesc(UUID applicationId);
    List<RevampDocumentRenewalRequest> findByApplicationIdAndBatchIdOrderByCreatedAtAsc(UUID applicationId, String batchId);
    List<RevampDocumentRenewalRequest> findByApplicationIdAndStatusIn(UUID applicationId, Collection<DocumentRenewalRequestStatus> statuses);
    Optional<RevampDocumentRenewalRequest> findFirstByApplicationIdAndDocumentTypeAndCertificationKeyAndStatusIn(
            UUID applicationId,
            String documentType,
            String certificationKey,
            Collection<DocumentRenewalRequestStatus> statuses
    );
    Optional<RevampDocumentRenewalRequest> findFirstByApplicationIdAndDocumentTypeAndCertificationKeyIsNullAndStatusIn(
            UUID applicationId,
            String documentType,
            Collection<DocumentRenewalRequestStatus> statuses
    );
}
