package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.model.RevampAuditEvent;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class RevampDashboardEventService {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(error -> emitters.remove(emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data("{\"connectedAt\":\"" + Instant.now() + "\"}"));
        } catch (IOException ex) {
            emitters.remove(emitter);
            emitter.completeWithError(ex);
        }

        return emitter;
    }

    public void publishAuditEvent(RevampAuditEvent auditEvent) {
        String payload = "{\"eventId\":\"" + auditEvent.getId()
                + "\",\"eventKey\":\"" + escape(auditEvent.getEventKey())
                + "\",\"entityType\":\"" + escape(auditEvent.getEntityType())
                + "\",\"entityId\":" + quoteNullable(auditEvent.getEntityId() == null ? null : auditEvent.getEntityId().toString())
                + ",\"requestId\":" + quoteNullable(auditEvent.getRequestId())
                + ",\"occurredAt\":\"" + auditEvent.getOccurredAt()
                + "\"}";

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("dashboard-activity")
                        .id(String.valueOf(auditEvent.getId()))
                        .data(payload));
            } catch (IOException | IllegalStateException ex) {
                emitters.remove(emitter);
                emitter.completeWithError(ex);
            }
        }
    }

    private String escape(String raw) {
        if (raw == null) return "";
        return raw.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private String quoteNullable(String raw) {
        return raw == null ? "null" : "\"" + escape(raw) + "\"";
    }
}
