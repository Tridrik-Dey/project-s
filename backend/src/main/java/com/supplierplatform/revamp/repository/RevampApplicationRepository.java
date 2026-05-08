package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface RevampApplicationRepository extends JpaRepository<RevampApplication, UUID> {
    List<RevampApplication> findByApplicantUserId(UUID applicantUserId);
    Optional<RevampApplication> findFirstByApplicantUserIdOrderByUpdatedAtDesc(UUID applicantUserId);
    List<RevampApplication> findByStatus(ApplicationStatus status);
    Optional<RevampApplication> findByProtocolCode(String protocolCode);
    Optional<RevampApplication> findFirstByInviteIdOrderByUpdatedAtDesc(UUID inviteId);
    List<RevampApplication> findByStatusAndUpdatedAtBefore(ApplicationStatus status, LocalDateTime updatedAt);

    @Query("""
            select case when count(a) > 0 then true else false end
            from RevampApplication a
            where a.registryType = :registryType
              and a.identityKeyType = :identityKeyType
              and a.identityValueNormalized = :identityValueNormalized
              and a.status in :blockingStatuses
              and (:excludedApplicationId is null or a.id <> :excludedApplicationId)
            """)
    boolean existsBlockingIdentity(
            @Param("registryType") RegistryType registryType,
            @Param("identityKeyType") String identityKeyType,
            @Param("identityValueNormalized") String identityValueNormalized,
            @Param("blockingStatuses") List<ApplicationStatus> blockingStatuses,
            @Param("excludedApplicationId") UUID excludedApplicationId
    );
}
