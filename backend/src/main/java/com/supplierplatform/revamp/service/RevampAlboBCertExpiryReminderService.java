package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.supplierplatform.revamp.dto.RevampAuditEventInputDto;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import com.supplierplatform.revamp.repository.RevampAuditEventRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RevampAlboBCertExpiryReminderService {

    private static final String EVENT_KEY   = "revamp.albo-b.cert-expiry-reminder.sent";
    private static final String ENTITY_TYPE = "REVAMP_APPLICATION";

    /** Human-readable labels keyed by the certificazioni JSON key. */
    private static final Map<String, String> CERT_LABELS = new LinkedHashMap<>();
    static {
        CERT_LABELS.put("iso9001",  "ISO 9001 — Qualità");
        CERT_LABELS.put("iso14001", "ISO 14001 — Ambiente");
        CERT_LABELS.put("iso45001", "ISO 45001 / OHSAS 18001 — Salute e Sicurezza");
        CERT_LABELS.put("sa8000",   "SA8000 — Responsabilità Sociale");
        CERT_LABELS.put("iso27001", "ISO 27001 — Sicurezza delle informazioni");
    }

    private final RevampApplicationSectionRepository sectionRepository;
    private final RevampAuditEventRepository auditEventRepository;
    private final RevampAuditService auditService;
    private final RevampAlboBCertExpiryMailService mailService;

    @Value("${app.reminders.albo-b-cert-expiry.enabled:true}")
    private boolean enabled;

    @Scheduled(cron = "${app.reminders.albo-b-cert-expiry.cron:0 0 9 * * *}")
    @Transactional
    public void runScheduled() {
        if (!enabled) {
            log.debug("Albo B cert expiry reminders disabled");
            return;
        }

        YearMonth nextMonth = YearMonth.now().plusMonths(1);
        // Request ID includes the target month so dedup is per-application per expiry-month.
        String requestId = "albo-b-cert-reminder-" + nextMonth;

        List<RevampApplicationSection> s4Sections =
                sectionRepository.findApprovedAlboBCompletedS4Sections();

        int scanned = s4Sections.size();
        int sent = 0;
        int duplicate = 0;
        int skipped = 0;
        int failed = 0;

        for (RevampApplicationSection s4 : s4Sections) {
            UUID applicationId = s4.getApplication().getId();

            if (auditEventRepository.existsByEventKeyAndEntityTypeAndEntityIdAndRequestId(
                    EVENT_KEY, ENTITY_TYPE, applicationId, requestId)) {
                duplicate++;
                continue;
            }

            // Collect certifications expiring next month
            List<String> expiringLabels = collectExpiringCerts(s4.getPayloadJson(), nextMonth);
            if (expiringLabels.isEmpty()) {
                skipped++;
                continue;
            }

            // Fetch S1 for company email and name
            Optional<RevampApplicationSection> s1Opt =
                    sectionRepository.findByApplicationIdAndSectionKeyAndIsLatestTrue(applicationId, "S1");
            if (s1Opt.isEmpty()) {
                log.warn("No S1 section found for applicationId={}, skipping cert reminder", applicationId);
                skipped++;
                continue;
            }

            JsonNode s1 = s1Opt.get().getPayloadJson();
            String recipientEmail = s1.path("institutionalEmail").asText(null);
            if (recipientEmail == null || recipientEmail.isBlank()) {
                recipientEmail = s1.path("email").asText(null);
            }
            String companyName = s1.path("companyName").asText("");

            if (recipientEmail == null || recipientEmail.isBlank()) {
                log.warn("No email found in S1 for applicationId={}, skipping cert reminder", applicationId);
                skipped++;
                continue;
            }

            RevampAlboBCertExpiryMailService.DispatchResult result =
                    mailService.sendCertExpiryReminder(recipientEmail, companyName, nextMonth, expiringLabels);

            if (result.sent()) {
                sent++;
                auditService.append(new RevampAuditEventInputDto(
                        EVENT_KEY,
                        ENTITY_TYPE,
                        applicationId,
                        null,
                        null,
                        requestId,
                        "albo-b cert expiry reminder",
                        null,
                        null,
                        "{\"expiryMonth\":\"" + nextMonth + "\"" +
                        ",\"recipientEmail\":\"" + esc(recipientEmail) + "\"" +
                        ",\"certs\":" + toJsonArray(expiringLabels) + "}"
                ));
            } else {
                failed++;
                log.warn("Albo B cert reminder failed applicationId={} email={} reason={}",
                        applicationId, recipientEmail, result.failureReason());
            }
        }

        log.info("Albo B cert expiry reminder run completed scanned={} sent={} duplicate={} skipped={} failed={}",
                scanned, sent, duplicate, skipped, failed);
    }

    private List<String> collectExpiringCerts(JsonNode s4Payload, YearMonth target) {
        List<String> labels = new ArrayList<>();

        // ISO certifications
        JsonNode certsNode = s4Payload.path("certificazioni");
        if (certsNode.isObject()) {
            for (Map.Entry<String, String> entry : CERT_LABELS.entrySet()) {
                JsonNode cert = certsNode.path(entry.getKey());
                if (!"si".equals(cert.path("presente").asText(""))) continue;
                String scadenza = cert.path("scadenza").asText(null);
                if (parseYearMonth(scadenza).filter(target::equals).isPresent()) {
                    labels.add(entry.getValue());
                }
            }
        }

        // Visura camerale and DURC expiry (stored in attachments array)
        JsonNode attachments = s4Payload.path("attachments");
        if (attachments.isArray()) {
            for (JsonNode att : attachments) {
                String docType  = att.path("documentType").asText("");
                String scadenza = att.path("scadenza").asText(null);
                if (scadenza == null) continue;
                if (!parseYearMonth(scadenza).filter(target::equals).isPresent()) continue;
                if ("VISURA_CAMERALE".equals(docType)) {
                    labels.add("Visura camerale ordinaria");
                } else if ("DURC".equals(docType)) {
                    labels.add("DURC — Documento Unico di Regolarità Contributiva");
                }
            }
        }

        return labels;
    }

    /** Parses MM/AAAA (e.g. "06/2025") into a YearMonth. */
    private Optional<YearMonth> parseYearMonth(String mmAaaa) {
        if (mmAaaa == null) return Optional.empty();
        String[] parts = mmAaaa.split("/");
        if (parts.length != 2) return Optional.empty();
        try {
            int month = Integer.parseInt(parts[0].trim());
            int year  = Integer.parseInt(parts[1].trim());
            if (month < 1 || month > 12 || year < 2000) return Optional.empty();
            return Optional.of(YearMonth.of(year, month));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private static String toJsonArray(List<String> items) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < items.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(esc(items.get(i))).append("\"");
        }
        sb.append("]");
        return sb.toString();
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
