package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.model.RevampApplicationSection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevampApplicationSectionRepository extends JpaRepository<RevampApplicationSection, UUID> {
    List<RevampApplicationSection> findByApplicationIdAndIsLatestTrue(UUID applicationId);
    Optional<RevampApplicationSection> findByApplicationIdAndSectionKeyAndIsLatestTrue(UUID applicationId, String sectionKey);
    Optional<RevampApplicationSection> findTopByApplicationIdAndSectionKeyOrderBySectionVersionDesc(UUID applicationId, String sectionKey);
    void deleteByApplicationId(UUID applicationId);

    @Query(value = """
            SELECT s.* FROM application_sections s
            JOIN applications a ON a.id = s.application_id
            JOIN users u ON u.id = a.applicant_user_id
            WHERE s.section_key = 'S1'
              AND s.is_latest = true
              AND s.completed = true
              AND s.payload_json->>'idDocumentExpiry' = :targetDate
              AND a.status = 'APPROVED'
              AND u.is_active = true
            """, nativeQuery = true)
    List<RevampApplicationSection> findApprovedS1SectionsExpiringOn(@Param("targetDate") String targetDate);

    @Query(value = """
            SELECT s.* FROM application_sections s
            JOIN applications a ON a.id = s.application_id
            JOIN users u ON u.id = a.applicant_user_id
            WHERE s.section_key = 'S1'
              AND s.is_latest = true
              AND s.completed = true
              AND s.payload_json->'legalRepresentative'->>'idDocumentExpiry' = :targetDate
              AND a.registry_type = 'ALBO_B'
              AND a.status = 'APPROVED'
              AND u.is_active = true
            """, nativeQuery = true)
    List<RevampApplicationSection> findApprovedAlboBLegalRepIdExpiringOn(@Param("targetDate") String targetDate);

    @Query(value = """
            SELECT s.* FROM application_sections s
            JOIN applications a ON a.id = s.application_id
            JOIN users u ON u.id = a.applicant_user_id
            WHERE s.section_key = 'S4'
              AND s.is_latest = true
              AND s.completed = true
              AND a.registry_type = 'ALBO_B'
              AND a.status = 'APPROVED'
              AND u.is_active = true
            """, nativeQuery = true)
    List<RevampApplicationSection> findApprovedAlboBCompletedS4Sections();
}
