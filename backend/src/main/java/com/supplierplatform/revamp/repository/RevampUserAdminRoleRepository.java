package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.AdminRole;
import com.supplierplatform.revamp.model.RevampUserAdminRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RevampUserAdminRoleRepository extends JpaRepository<RevampUserAdminRole, UUID> {
    List<RevampUserAdminRole> findByUserId(UUID userId);
    List<RevampUserAdminRole> findByAdminRole(AdminRole adminRole);
    boolean existsByUserIdAndAdminRole(UUID userId, AdminRole adminRole);
    long countByAdminRole(AdminRole adminRole);

    @Query("SELECT COUNT(r) FROM RevampUserAdminRole r WHERE r.adminRole = :adminRole AND r.user.isActive = true")
    long countActiveByAdminRole(@Param("adminRole") AdminRole adminRole);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM RevampUserAdminRole r WHERE r.user.id = :userId AND r.adminRole = :adminRole")
    int deleteByUserIdAndAdminRole(@Param("userId") UUID userId, @Param("adminRole") AdminRole adminRole);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM RevampUserAdminRole r WHERE r.user.id = :userId")
    int deleteByUserId(@Param("userId") UUID userId);
}
