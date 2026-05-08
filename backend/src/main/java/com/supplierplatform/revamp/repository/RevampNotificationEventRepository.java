package com.supplierplatform.revamp.repository;

import com.supplierplatform.revamp.enums.NotificationDeliveryStatus;
import com.supplierplatform.revamp.model.RevampNotificationEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RevampNotificationEventRepository extends JpaRepository<RevampNotificationEvent, UUID> {
    List<RevampNotificationEvent> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, UUID entityId);
    List<RevampNotificationEvent> findByDeliveryStatusOrderByCreatedAtDesc(NotificationDeliveryStatus deliveryStatus);
}

