package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.NotificationTemplateDto;
import com.supplierplatform.revamp.dto.RevampNotificationEventSummaryDto;
import com.supplierplatform.revamp.enums.NotificationDeliveryStatus;
import com.supplierplatform.revamp.model.RevampNotificationEvent;
import com.supplierplatform.revamp.repository.RevampNotificationEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class RevampNotificationEventService {

    private final RevampNotificationEventRepository notificationEventRepository;
    private final ObjectMapper objectMapper;
    private final Map<String, String> templates = new ConcurrentHashMap<>();

    @Transactional
    public RevampNotificationEvent createPending(
            String eventKey,
            String entityType,
            UUID entityId,
            String recipient,
            String templateKey,
            Integer templateVersion,
            String payloadJson
    ) {
        RevampNotificationEvent event = new RevampNotificationEvent();
        event.setEventKey(eventKey);
        event.setEntityType(entityType);
        event.setEntityId(entityId);
        event.setRecipient(recipient);
        event.setTemplateKey(templateKey);
        event.setTemplateVersion(templateVersion);
        event.setPayloadJson(parseJsonRequired(payloadJson, "payloadJson"));
        event.setDeliveryStatus(NotificationDeliveryStatus.PENDING);
        return notificationEventRepository.save(event);
    }

    @Transactional
    public RevampNotificationEvent markSent(UUID eventId, String providerMessageId) {
        RevampNotificationEvent event = notificationEventRepository.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("RevampNotificationEvent", eventId));
        event.setDeliveryStatus(NotificationDeliveryStatus.SENT);
        event.setProviderMessageId(providerMessageId);
        event.setSentAt(LocalDateTime.now());
        return notificationEventRepository.save(event);
    }

    @Transactional
    public RevampNotificationEvent markFailed(UUID eventId) {
        RevampNotificationEvent event = notificationEventRepository.findById(eventId)
                .orElseThrow(() -> new EntityNotFoundException("RevampNotificationEvent", eventId));
        event.setDeliveryStatus(NotificationDeliveryStatus.FAILED);
        event.setRetryCount((event.getRetryCount() == null ? 0 : event.getRetryCount()) + 1);
        return notificationEventRepository.save(event);
    }

    @Transactional(readOnly = true)
    public List<RevampNotificationEventSummaryDto> listEvents(
            String entityType,
            UUID entityId,
            NotificationDeliveryStatus deliveryStatus
    ) {
        return notificationEventRepository.findAll().stream()
                .filter(event -> entityType == null || entityType.equals(event.getEntityType()))
                .filter(event -> entityId == null || entityId.equals(event.getEntityId()))
                .filter(event -> deliveryStatus == null || deliveryStatus == event.getDeliveryStatus())
                .sorted(Comparator.comparing(RevampNotificationEvent::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<NotificationTemplateDto> getTemplates() {
        return templates.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new NotificationTemplateDto(e.getKey(), e.getValue()))
                .toList();
    }

    @Transactional
    public NotificationTemplateDto upsertTemplate(String key, String content) {
        templates.put(key, content);
        return new NotificationTemplateDto(key, content);
    }

    private RevampNotificationEventSummaryDto toSummary(RevampNotificationEvent event) {
        return new RevampNotificationEventSummaryDto(
                event.getId(),
                event.getEventKey(),
                event.getEntityType(),
                event.getEntityId(),
                event.getRecipient(),
                event.getTemplateKey(),
                event.getTemplateVersion(),
                event.getDeliveryStatus() != null ? event.getDeliveryStatus().name() : null,
                event.getRetryCount(),
                event.getCreatedAt(),
                event.getSentAt()
        );
    }

    private JsonNode parseJsonRequired(String raw, String fieldName) {
        String normalized = (raw == null || raw.isBlank()) ? "{}" : raw;
        try {
            return objectMapper.readTree(normalized);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Invalid JSON for " + fieldName, ex);
        }
    }
}
