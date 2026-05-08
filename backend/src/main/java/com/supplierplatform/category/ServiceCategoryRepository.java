package com.supplierplatform.category;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ServiceCategoryRepository extends JpaRepository<ServiceCategory, UUID> {

    List<ServiceCategory> findByIsActiveTrue();

    List<ServiceCategory> findByParentIsNull();

    List<ServiceCategory> findByParentId(UUID parentId);
}
