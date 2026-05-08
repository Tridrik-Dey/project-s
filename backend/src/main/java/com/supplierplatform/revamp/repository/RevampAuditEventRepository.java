package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.model.RevampAuditEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RevampAuditEventRepository extends JpaRepository<RevampAuditEvent, UUID> {
    List<RevampAuditEvent> findByEntityTypeAndEntityIdOrderByOccurredAtDesc(String entityType, UUID entityId);
    List<RevampAuditEvent> findByRequestId(String requestId);
    boolean existsByEventKeyAndEntityTypeAndEntityIdAndRequestId(String eventKey, String entityType, UUID entityId, String requestId);
}
