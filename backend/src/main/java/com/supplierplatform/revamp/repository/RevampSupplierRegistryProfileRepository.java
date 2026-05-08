package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.RegistryProfileStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevampSupplierRegistryProfileRepository extends JpaRepository<RevampSupplierRegistryProfile, UUID> {
    Optional<RevampSupplierRegistryProfile> findByApplicationId(UUID applicationId);
    List<RevampSupplierRegistryProfile> findByStatus(RegistryProfileStatus status);
    List<RevampSupplierRegistryProfile> findBySupplierUserId(UUID supplierUserId);

    @Query("""
            select p from RevampSupplierRegistryProfile p
            where (:registryType is null or p.registryType = :registryType)
              and (:status is null or p.status = :status)
              and (
                :query is null
                or lower(coalesce(p.displayName, '')) like lower(concat('%', :query, '%'))
                or lower(coalesce(p.publicSummary, '')) like lower(concat('%', :query, '%'))
                or lower(coalesce(p.supplierUser.email, '')) like lower(concat('%', :query, '%'))
              )
              and (
                :ateco is null
                or exists (
                  select 1 from RevampSupplierRegistryProfileDetail d
                  where d.profile.id = p.id
                    and lower(coalesce(d.searchAtecoPrimary, '')) like lower(concat('%', :ateco, '%'))
                )
              )
              and (
                :region is null
                or exists (
                  select 1 from RevampSupplierRegistryProfileDetail d
                  where d.profile.id = p.id
                    and lower(coalesce(d.searchRegionsCsv, '')) like lower(concat('%', :region, '%'))
                )
              )
              and (
                :serviceCategory is null
                or exists (
                  select 1 from RevampSupplierRegistryProfileDetail d
                  where d.profile.id = p.id
                    and lower(coalesce(d.searchServiceCategoriesCsv, '')) like lower(concat('%', :serviceCategory, '%'))
                )
              )
              and (
                :certification is null
                or exists (
                  select 1 from RevampSupplierRegistryProfileDetail d
                  where d.profile.id = p.id
                    and lower(coalesce(d.searchCertificationsCsv, '')) like lower(concat('%', :certification, '%'))
                )
              )
            """)
    Page<RevampSupplierRegistryProfile> searchAdminProfiles(
            @Param("registryType") RegistryType registryType,
            @Param("status") RegistryProfileStatus status,
            @Param("query") String query,
            @Param("ateco") String ateco,
            @Param("region") String region,
            @Param("serviceCategory") String serviceCategory,
            @Param("certification") String certification,
            Pageable pageable
    );
}
