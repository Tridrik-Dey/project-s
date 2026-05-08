package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.model.RevampSupplierRegistryProfileDetail;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RevampSupplierRegistryProfileDetailRepository extends JpaRepository<RevampSupplierRegistryProfileDetail, UUID> {
    Optional<RevampSupplierRegistryProfileDetail> findByProfileId(UUID profileId);
    List<RevampSupplierRegistryProfileDetail> findByProfileIdIn(Collection<UUID> profileIds);
}
