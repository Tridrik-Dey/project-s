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
public class RevampAlboBLegalRepIdExpiryReminderService {

    private static final String EVENT_KEY   = "revamp.albo-b.legal-rep-id.expiry-reminder.sent";
    private static final String ENTITY_TYPE = "REVAMP_APPLICATION";
    private static final String REQUEST_ID  = "albo-b-legal-rep-id-reminder-30d";
    private static final int    DAYS_BEFORE = 30;

    private final RevampApplicationSectionRepository sectionRepository;
    private final RevampAuditEventRepository auditEventRepository;
    private final RevampAuditService auditService;
    private final RevampAlboBLegalRepMailService mailService;
    private final RevampDocumentRenewalRequestService documentRenewalRequestService;

    @Value("${app.reminders.albo-b-legal-rep-id-expiry.enabled:true}")
    private boolean enabled;

    @Scheduled(cron = "${app.reminders.albo-b-legal-rep-id-expiry.cron:0 0 9 * * *}")
    @Transactional
    public void runScheduled() {
        if (!enabled) {
            log.debug("Albo B legal rep ID expiry reminders disabled");
            return;
        }

        String targetDate = LocalDate.now().plusDays(DAYS_BEFORE)
                .format(DateTimeFormatter.ISO_LOCAL_DATE);

        java.util.List<RevampApplicationSection> candidates =
                sectionRepository.findApprovedAlboBLegalRepIdExpiringOn(targetDate);

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
            String recipientEmail = payload.path("institutionalEmail").asText(null);
            if (recipientEmail == null || recipientEmail.isBlank()) {
                recipientEmail = payload.path("email").asText(null);
            }
            String companyName   = payload.path("companyName").asText("");
            String expiryDateStr = payload.path("legalRepresentative").path("idDocumentExpiry").asText(null);

            if (recipientEmail == null || expiryDateStr == null) {
                log.warn("Skipping section {} — missing email or legalRepresentative.idDocumentExpiry", section.getId());
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

            RevampAlboBLegalRepMailService.DispatchResult result =
                    mailService.sendExpiryReminder(recipientEmail, companyName, expiryDate);

            if (result.sent()) {
                documentRenewalRequestService.createReminderIfAbsent(
                        applicationId,
                        REQUEST_ID + "-" + applicationId,
                        "S1",
                        "ID_DOCUMENT",
                        "Carta d'identita rappresentante legale",
                        "ID_DOCUMENT",
                        null,
                        payload.path("legalRepresentative").path("idDocumentAttachment").deepCopy(),
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
                        "albo-b legal rep ID expiry reminder",
                        null,
                        null,
                        "{\"daysBefore\":" + DAYS_BEFORE +
                        ",\"recipientEmail\":\"" + esc(recipientEmail) + "\"" +
                        ",\"companyName\":\"" + esc(companyName) + "\"" +
                        ",\"expiryDate\":\"" + esc(expiryDateStr) + "\"}"
                ));
            } else {
                failed++;
                log.warn("Albo B legal rep ID reminder failed applicationId={} email={} reason={}",
                        applicationId, recipientEmail, result.failureReason());
            }
        }

        log.info("Albo B legal rep ID expiry reminder run completed scanned={} sent={} duplicate={} failed={}",
                scanned, sent, duplicate, failed);
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
