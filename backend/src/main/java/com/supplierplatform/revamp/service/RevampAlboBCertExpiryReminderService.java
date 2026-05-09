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

import java.time.LocalDate;
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

    private static final String EVENT_KEY = "revamp.albo-b.cert-expiry-reminder.sent";
    private static final String ENTITY_TYPE = "REVAMP_APPLICATION";

    private static final Map<String, String> CERT_LABELS = new LinkedHashMap<>();
    static {
        CERT_LABELS.put("iso9001", "ISO 9001 - Qualita");
        CERT_LABELS.put("iso14001", "ISO 14001 - Ambiente");
        CERT_LABELS.put("iso45001", "ISO 45001 / OHSAS 18001 - Salute e Sicurezza");
        CERT_LABELS.put("sa8000", "SA8000 - Responsabilita Sociale");
        CERT_LABELS.put("iso27001", "ISO 27001 - Sicurezza delle informazioni");
    }

    private final RevampApplicationSectionRepository sectionRepository;
    private final RevampAuditEventRepository auditEventRepository;
    private final RevampAuditService auditService;
    private final RevampAlboBCertExpiryMailService mailService;
    private final RevampDocumentRenewalRequestService documentRenewalRequestService;

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
        String requestId = "albo-b-cert-reminder-" + LocalDate.now();

        List<RevampApplicationSection> s4Sections = sectionRepository.findApprovedAlboBCompletedS4Sections();

        int scanned = s4Sections.size();
        int sent = 0;
        int duplicate = 0;
        int skipped = 0;
        int failed = 0;

        for (RevampApplicationSection s4 : s4Sections) {
            UUID applicationId = s4.getApplication().getId();

            List<ExpiringDocument> expiringDocuments = collectExpiringDocuments(s4.getPayloadJson(), nextMonth);
            String batchId = requestId + "-" + applicationId;
            List<ExpiringDocument> createdDocuments = expiringDocuments.stream()
                    .filter(document -> documentRenewalRequestService.createReminderIfAbsent(
                            applicationId,
                            batchId,
                            "S4",
                            document.documentType(),
                            document.label(),
                            document.integrationItemCode(),
                            document.certificationKey(),
                            document.oldAttachmentJson(),
                            RevampDocumentRenewalRequestService.expiryDateFromYearMonth(nextMonth)
                    ))
                    .toList();
            List<String> expiringLabels = createdDocuments.stream().map(ExpiringDocument::label).toList();
            if (expiringLabels.isEmpty()) {
                if (!expiringDocuments.isEmpty()) duplicate++;
                skipped++;
                continue;
            }

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
                        "{\"expiryMonth\":\"" + nextMonth + "\""
                                + ",\"recipientEmail\":\"" + esc(recipientEmail) + "\""
                                + ",\"batchId\":\"" + esc(batchId) + "\""
                                + ",\"certs\":" + toJsonArray(expiringLabels) + "}"
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

    private List<ExpiringDocument> collectExpiringDocuments(JsonNode s4Payload, YearMonth target) {
        List<ExpiringDocument> documents = new ArrayList<>();

        JsonNode certsNode = s4Payload.path("certificazioni");
        if (certsNode.isObject()) {
            for (Map.Entry<String, String> entry : CERT_LABELS.entrySet()) {
                JsonNode cert = certsNode.path(entry.getKey());
                if (!"si".equals(cert.path("presente").asText(""))) continue;
                String scadenza = cert.path("scadenza").asText(null);
                if (parseYearMonth(scadenza).filter(target::equals).isPresent()) {
                    documents.add(new ExpiringDocument(
                            "CERTIFICATION",
                            entry.getValue(),
                            integrationCodeForCert(entry.getKey()),
                            entry.getKey(),
                            findAttachment(s4Payload, "CERTIFICATION", entry.getKey())
                    ));
                }
            }
        }

        JsonNode attachments = s4Payload.path("attachments");
        if (attachments.isArray()) {
            for (JsonNode att : attachments) {
                String docType = att.path("documentType").asText("");
                String scadenza = att.path("scadenza").asText(null);
                if (scadenza == null) continue;
                if (!parseYearMonth(scadenza).filter(target::equals).isPresent()) continue;
                if ("VISURA_CAMERALE".equals(docType)) {
                    documents.add(new ExpiringDocument("VISURA_CAMERALE", "Visura camerale ordinaria", "VISURA_CAMERALE", null, att.deepCopy()));
                } else if ("DURC".equals(docType)) {
                    documents.add(new ExpiringDocument("DURC", "DURC - Documento Unico di Regolarita Contributiva", "DURC", null, att.deepCopy()));
                }
            }
        }

        return documents;
    }

    private JsonNode findAttachment(JsonNode s4Payload, String documentType, String certificationKey) {
        JsonNode attachments = s4Payload.path("attachments");
        if (!attachments.isArray()) return null;
        for (JsonNode att : attachments) {
            if (!documentType.equals(att.path("documentType").asText(""))) continue;
            if (certificationKey == null || certificationKey.isBlank()) {
                if (!att.hasNonNull("certificationKey") || att.path("certificationKey").asText("").isBlank()) {
                    return att.deepCopy();
                }
            } else if (certificationKey.equals(att.path("certificationKey").asText(""))) {
                return att.deepCopy();
            }
        }
        return null;
    }

    private String integrationCodeForCert(String certKey) {
        return switch (certKey) {
            case "iso9001" -> "CERT_ISO_9001";
            case "iso14001" -> "CERT_ISO_14001";
            case "iso45001" -> "CERT_ISO_45001";
            case "sa8000" -> "CERT_SA8000";
            default -> "CERTIFICATIONS_ACCREDITATIONS";
        };
    }

    private Optional<YearMonth> parseYearMonth(String mmAaaa) {
        if (mmAaaa == null) return Optional.empty();
        String[] parts = mmAaaa.split("/");
        if (parts.length != 2) return Optional.empty();
        try {
            int month = Integer.parseInt(parts[0].trim());
            int year = Integer.parseInt(parts[1].trim());
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

    private record ExpiringDocument(
            String documentType,
            String label,
            String integrationItemCode,
            String certificationKey,
            JsonNode oldAttachmentJson
    ) {
    }
}
