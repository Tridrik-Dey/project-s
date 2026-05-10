package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.enums.ReviewDecision;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampFieldChangeRequest;
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
public class RevampFieldChangeRequestMailService {

    private static final String ENTITY_TYPE = "FIELD_CHANGE_REQUEST";

    private final JavaMailSender javaMailSender;
    private final RevampNotificationEventService notificationEventService;

    @Value("${app.frontend.base-url:http://127.0.0.1:5173}")
    private String frontendBaseUrl;

    public void sendUnlockNotice(RevampFieldChangeRequest fcr, String adminNote) {
        sendAdminActionNotice(
                fcr,
                "fcr.unlock.email",
                "Modifica dati sbloccata",
                "La tua richiesta di modifica dati e stata accettata.",
                "Puoi aggiornare la sezione richiesta dalla tua area riservata.",
                adminNote
        );
    }

    public void sendAdminRejectNotice(RevampFieldChangeRequest fcr, String adminNote) {
        sendAdminActionNotice(
                fcr,
                "fcr.admin_rejected.email",
                "Richiesta modifica dati respinta",
                "La tua richiesta di modifica dati e stata respinta.",
                "Il profilo rimane attivo con i valori precedentemente approvati.",
                adminNote
        );
    }

    public void sendOutcomeNotice(RevampFieldChangeRequest fcr, ReviewDecision decision, String reason) {
        RevampApplication application = fcr != null ? fcr.getApplication() : null;
        String recipient = resolveRecipient(application);
        if (recipient == null) {
            log.warn("Skipping field-change outcome email: FCR {} has no applicant email", fcr != null ? fcr.getId() : null);
            return;
        }

        boolean approved = decision == ReviewDecision.APPROVED;
        RevampNotificationEvent event = notificationEventService.createPending(
                approved ? "fcr.outcome.approved.email" : "fcr.outcome.rejected.email",
                ENTITY_TYPE,
                fcr.getId(),
                recipient,
                null,
                null,
                "{\"applicationId\":\"" + esc(application != null && application.getId() != null ? application.getId().toString() : "")
                        + "\",\"sectionKey\":\"" + esc(fcr.getSectionKey())
                        + "\",\"decision\":\"" + esc(decision != null ? decision.name() : "")
                        + "\",\"reason\":\"" + esc(reason) + "\"}"
        );

        try {
            var message = javaMailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setTo(recipient);
            helper.setSubject(approved ? "Modifica dati approvata" : "Modifica dati respinta");
            helper.setText(buildBody(application, fcr, approved, reason), false);
            javaMailSender.send(message);
            notificationEventService.markSent(event.getId(), null);
            log.info("Field-change outcome email sent to {} for FCR {}", recipient, fcr.getId());
        } catch (Exception ex) {
            notificationEventService.markFailed(event.getId(), notificationEventService.failureReason(ex));
            log.error("Failed to send field-change outcome email to {} for FCR {}", recipient, fcr.getId(), ex);
        }
    }

    private void sendAdminActionNotice(
            RevampFieldChangeRequest fcr,
            String eventKey,
            String subject,
            String headline,
            String instruction,
            String adminNote
    ) {
        RevampApplication application = fcr != null ? fcr.getApplication() : null;
        String recipient = resolveRecipient(application);
        if (recipient == null) {
            log.warn("Skipping field-change admin action email: FCR {} has no applicant email", fcr != null ? fcr.getId() : null);
            return;
        }

        RevampNotificationEvent event = notificationEventService.createPending(
                eventKey,
                ENTITY_TYPE,
                fcr.getId(),
                recipient,
                null,
                null,
                "{\"applicationId\":\"" + esc(application != null && application.getId() != null ? application.getId().toString() : "")
                        + "\",\"sectionKey\":\"" + esc(fcr.getSectionKey())
                        + "\",\"adminNote\":\"" + esc(adminNote) + "\"}"
        );

        try {
            var message = javaMailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setTo(recipient);
            helper.setSubject(subject);
            helper.setText(buildAdminActionBody(application, fcr, headline, instruction, adminNote), false);
            javaMailSender.send(message);
            notificationEventService.markSent(event.getId(), null);
            log.info("Field-change admin action email sent to {} for FCR {}", recipient, fcr.getId());
        } catch (Exception ex) {
            notificationEventService.markFailed(event.getId(), notificationEventService.failureReason(ex));
            log.error("Failed to send field-change admin action email to {} for FCR {}", recipient, fcr.getId(), ex);
        }
    }

    private String buildAdminActionBody(
            RevampApplication application,
            RevampFieldChangeRequest fcr,
            String headline,
            String instruction,
            String adminNote
    ) {
        StringBuilder body = new StringBuilder();
        body.append("Gentile Fornitore,\n\n");
        body.append(headline).append("\n\n");
        if (application != null && application.getProtocolCode() != null && !application.getProtocolCode().isBlank()) {
            body.append("Codice candidatura: ").append(application.getProtocolCode().trim()).append("\n");
        }
        body.append("Campo richiesto: ").append(fcr.getSectionKey()).append("\n");
        if (adminNote != null && !adminNote.isBlank()) {
            body.append("Nota: ").append(adminNote.trim()).append("\n");
        }
        body.append("\n").append(instruction).append("\n");
        body.append("\nPuoi consultare lo storico nella tua area riservata:\n");
        body.append(buildLoginUrl()).append("\n\n");
        body.append("Cordiali saluti,\n");
        body.append("Gruppo Solco");
        return body.toString();
    }

    private String buildBody(RevampApplication application, RevampFieldChangeRequest fcr, boolean approved, String reason) {
        StringBuilder body = new StringBuilder();
        body.append("Gentile Fornitore,\n\n");
        body.append("la tua richiesta di modifica dati e stata ")
                .append(approved ? "approvata." : "respinta.")
                .append("\n\n");
        if (application != null && application.getProtocolCode() != null && !application.getProtocolCode().isBlank()) {
            body.append("Codice candidatura: ").append(application.getProtocolCode().trim()).append("\n");
        }
        body.append("Campo richiesto: ").append(fcr.getSectionKey()).append("\n");
        if (reason != null && !reason.isBlank()) {
            body.append("Motivazione: ").append(reason.trim()).append("\n");
        }
        if (!approved) {
            body.append("\nIl profilo rimane attivo con i valori precedentemente approvati.\n");
        }
        body.append("\nPuoi consultare lo storico nella tua area riservata:\n");
        body.append(buildLoginUrl()).append("\n\n");
        body.append("Cordiali saluti,\n");
        body.append("Gruppo Solco");
        return body.toString();
    }

    private String buildLoginUrl() {
        String normalizedBase = frontendBaseUrl == null ? "" : frontendBaseUrl.trim().replaceAll("/+$", "");
        return normalizedBase + "/login";
    }

    private String resolveRecipient(RevampApplication application) {
        if (application == null) return null;
        User applicant = application.getApplicantUser();
        if (applicant == null || applicant.getEmail() == null || applicant.getEmail().isBlank()) return null;
        return applicant.getEmail().trim();
    }

    private static String esc(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
