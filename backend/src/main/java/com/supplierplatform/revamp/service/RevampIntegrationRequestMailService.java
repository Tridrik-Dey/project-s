package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampIntegrationRequest;
import com.supplierplatform.revamp.model.RevampNotificationEvent;
import com.supplierplatform.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
@Slf4j
public class RevampIntegrationRequestMailService {

    private static final String ENTITY_TYPE = "REVAMP_APPLICATION";

    private final JavaMailSender javaMailSender;
    private final RevampNotificationEventService notificationEventService;

    @Value("${app.frontend.base-url:http://127.0.0.1:5173}")
    private String frontendBaseUrl;

    public void sendIntegrationRequestNotice(RevampApplication application, RevampIntegrationRequest request) {
        String recipient = resolveRecipient(application);
        if (recipient == null) {
            log.warn("Skipping integration request email: application {} has no applicant email", application != null ? application.getId() : null);
            return;
        }

        RevampNotificationEvent event = notificationEventService.createPending(
                "revamp.integration_request.email",
                ENTITY_TYPE,
                application.getId(),
                recipient,
                null,
                null,
                "{\"integrationRequestId\":\"" + esc(request.getId() != null ? request.getId().toString() : "")
                        + "\",\"protocolCode\":\"" + esc(application.getProtocolCode()) + "\"}"
        );

        try {
            var message = javaMailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setTo(recipient);
            helper.setSubject("Richiesta integrazione - Albo Fornitori Digitale");
            helper.setText(buildBody(application), false);
            javaMailSender.send(message);
            notificationEventService.markSent(event.getId(), null);
            log.info("Integration request email sent to {} for application {}", recipient, application.getId());
        } catch (Exception ex) {
            notificationEventService.markFailed(event.getId(), notificationEventService.failureReason(ex));
            log.error("Failed to send integration request email to {} for application {}", recipient, application.getId(), ex);
        }
    }

    private String buildBody(RevampApplication application) {
        String displayName = resolveDisplayName(application);
        String protocolCode = application.getProtocolCode();
        String loginUrl = buildLoginUrl();

        StringBuilder body = new StringBuilder();
        body.append("Gentile ").append(displayName).append(",\n\n");
        body.append("il Gruppo Solco ha inviato una richiesta di integrazione per la tua candidatura all'Albo Fornitori Digitale.\n\n");
        if (protocolCode != null && !protocolCode.isBlank()) {
            body.append("Codice candidatura: ").append(protocolCode.trim()).append("\n\n");
        }
        body.append("Per vedere la richiesta e completare le modifiche richieste, accedi alla piattaforma con il tuo account:\n");
        body.append(loginUrl).append("\n\n");
        body.append("Dopo l'accesso troverai la richiesta nella tua area riservata.\n\n");
        body.append("Cordiali saluti,\n");
        body.append("Gruppo Solco");
        return body.toString();
    }

    private String buildLoginUrl() {
        String normalizedBase = frontendBaseUrl == null ? "" : frontendBaseUrl.trim().replaceAll("/+$", "");
        return normalizedBase + "/login";
    }

    private String resolveRecipient(RevampApplication application) {
        if (application == null) {
            return null;
        }
        User applicant = application.getApplicantUser();
        if (applicant == null || applicant.getEmail() == null || applicant.getEmail().isBlank()) {
            return null;
        }
        return applicant.getEmail().trim();
    }

    private String resolveDisplayName(RevampApplication application) {
        return "Fornitore";
    }

    private static String esc(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
