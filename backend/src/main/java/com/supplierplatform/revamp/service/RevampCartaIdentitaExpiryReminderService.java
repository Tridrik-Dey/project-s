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
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@Slf4j
public class RevampCartaIdentitaExpiryReminderService {

    private static final String EVENT_KEY   = "revamp.carta-identita.expiry-reminder.sent";
    private static final String ENTITY_TYPE = "REVAMP_APPLICATION";
    private static final String REQUEST_ID  = "carta-identita-reminder-30d";
    private static final int    DAYS_BEFORE = 30;

    private final RevampApplicationSectionRepository sectionRepository;
    private final RevampAuditEventRepository auditEventRepository;
    private final RevampAuditService auditService;
    private final RevampCartaIdentitaMailService mailService;
    private final RevampDocumentRenewalRequestService documentRenewalRequestService;

    @Value("${app.reminders.carta-identita-expiry.enabled:true}")
    private boolean enabled;

    @Scheduled(cron = "${app.reminders.carta-identita-expiry.cron:0 0 9 * * *}")
    @Transactional
    public void runScheduled() {
        if (!enabled) {
            log.debug("Carta identita expiry reminders disabled");
            return;
        }

        String targetDate = LocalDate.now().plusDays(DAYS_BEFORE)
                .format(DateTimeFormatter.ISO_LOCAL_DATE);

        java.util.List<RevampApplicationSection> candidates =
                sectionRepository.findApprovedS1SectionsExpiringOn(targetDate);

        int scanned = candidates.size();
        int sent = 0;
        int duplicate = 0;
        int failed = 0;

        for (RevampApplicationSection section : candidates) {
            java.util.UUID applicationId = section.getApplication().getId();

            if (auditEventRepository.existsByEventKeyAndEntityTypeAndEntityIdAndRequestId(
                    EVENT_KEY, ENTITY_TYPE, applicationId, REQUEST_ID)) {
                duplicate++;
                continue;
            }

            JsonNode payload = section.getPayloadJson();
            String recipientEmail = payload.path("email").asText(null);
            String expiryDateStr  = payload.path("idDocumentExpiry").asText(null);

            if (recipientEmail == null || expiryDateStr == null) {
                log.warn("Skipping section {} — missing email or idDocumentExpiry", section.getId());
                failed++;
                continue;
            }

            LocalDate expiryDate;
            try {
                expiryDate = LocalDate.parse(expiryDateStr, DateTimeFormatter.ISO_LOCAL_DATE);
            } catch (Exception ex) {
                log.warn("Skipping section {} — unparseable idDocumentExpiry: {}", section.getId(), expiryDateStr);
                failed++;
                continue;
            }

            RevampCartaIdentitaMailService.DispatchResult result =
                    mailService.sendExpiryReminder(recipientEmail, expiryDate);

            if (result.sent()) {
                documentRenewalRequestService.createReminderIfAbsent(
                        applicationId,
                        REQUEST_ID + "-" + applicationId,
                        "S1",
                        "ID_DOCUMENT",
                        "Carta d'identita",
                        "ID_DOCUMENT",
                        null,
                        payload.path("profilePhotoAttachment").deepCopy(),
                        expiryDate
                );
                sent++;
                auditService.append(new RevampAuditEventInputDto(
                        EVENT_KEY,
                        ENTITY_TYPE,
                        applicationId,
                        null,
                        null,
                        REQUEST_ID,
                        "carta identita expiry reminder",
                        null,
                        null,
                        "{\"daysBefore\":" + DAYS_BEFORE +
                        ",\"recipientEmail\":\"" + esc(recipientEmail) + "\"" +
                        ",\"expiryDate\":\"" + esc(expiryDateStr) + "\"}"
                ));
            } else {
                failed++;
                log.warn("Carta identita reminder failed applicationId={} email={} reason={}",
                        applicationId, recipientEmail, result.failureReason());
            }
        }

        log.info("Carta identita expiry reminder run completed scanned={} sent={} duplicate={} failed={}",
                scanned, sent, duplicate, failed);
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
