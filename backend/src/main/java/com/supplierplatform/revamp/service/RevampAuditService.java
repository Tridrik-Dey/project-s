package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.dto.RevampAuditEventSummaryDto;
import com.supplierplatform.revamp.model.RevampAuditEvent;
import com.supplierplatform.revamp.repository.RevampAuditEventRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RevampAuditService {

    private final RevampAuditEventRepository auditEventRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final RevampDashboardEventService dashboardEventService;

    @Transactional
    public RevampAuditEvent append(RevampAuditEventInputDto input) {
        RevampAuditEvent event = new RevampAuditEvent();
        event.setEventKey(input.eventKey());
        event.setEntityType(input.entityType());
        event.setEntityId(input.entityId());
        event.setActorRoles(input.actorRoles());
        event.setRequestId(input.requestId());
        event.setReason(input.reason());
        event.setBeforeStateJson(parseJsonNullable(input.beforeStateJson(), "beforeStateJson"));
        event.setAfterStateJson(parseJsonNullable(input.afterStateJson(), "afterStateJson"));
        event.setMetadataJson(parseJsonRequired(input.metadataJson(), "metadataJson"));

        UUID actorUserId = input.actorUserId();
        if (actorUserId != null) {
            User actor = userRepository.findById(actorUserId)
                    .orElseThrow(() -> new EntityNotFoundException("User", actorUserId));
            event.setActorUser(actor);
        }

        RevampAuditEvent saved = auditEventRepository.save(event);
        dashboardEventService.publishAuditEvent(saved);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<RevampAuditEventSummaryDto> listEvents(String entityType, UUID entityId, String requestId) {
        return auditEventRepository.findAll().stream()
                .filter(event -> entityType == null || entityType.equals(event.getEntityType()))
                .filter(event -> entityId == null || entityId.equals(event.getEntityId()))
                .filter(event -> requestId == null || requestId.equals(event.getRequestId()))
                .sorted(Comparator.comparing(RevampAuditEvent::getOccurredAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toSummary)
                .toList();
    }

    private RevampAuditEventSummaryDto toSummary(RevampAuditEvent event) {
        return new RevampAuditEventSummaryDto(
                event.getId(),
                event.getEventKey(),
                event.getEntityType(),
                event.getEntityId(),
                event.getActorUser() != null ? event.getActorUser().getId() : null,
                event.getActorRoles(),
                event.getRequestId(),
                event.getReason(),
                toJsonString(event.getBeforeStateJson()),
                toJsonString(event.getAfterStateJson()),
                toJsonString(event.getMetadataJson()),
                event.getOccurredAt()
        );
    }

    private JsonNode parseJsonNullable(String raw, String fieldName) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return objectMapper.readTree(raw);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Invalid JSON for " + fieldName, ex);
        }
    }

    private JsonNode parseJsonRequired(String raw, String fieldName) {
        String normalized = (raw == null || raw.isBlank()) ? "{}" : raw;
        return parseJsonNullable(normalized, fieldName);
    }

    private String toJsonString(JsonNode node) {
        return node == null ? null : node.toString();
    }
}
