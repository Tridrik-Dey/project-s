package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.enums.ReviewDecision;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampDocumentRenewalRequest;
import com.supplierplatform.revamp.model.RevampNotificationEvent;
import com.supplierplatform.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RevampDocumentRenewalRequestMailService {

    private static final String ENTITY_TYPE = "DOCUMENT_RENEWAL_REQUEST";

    private final JavaMailSender javaMailSender;
    private final RevampNotificationEventService notificationEventService;

    @Value("${app.frontend.base-url:http://127.0.0.1:5173}")
    private String frontendBaseUrl;

    public void sendOutcomeNotice(List<RevampDocumentRenewalRequest> requests, ReviewDecision decision, String reason) {
        if (requests == null || requests.isEmpty()) return;
        RevampApplication application = requests.get(0).getApplication();
        String recipient = resolveRecipient(application);
        if (recipient == null) {
            log.warn("Skipping document-renewal outcome email: application {} has no applicant email",
                    application != null ? application.getId() : null);
            return;
        }

        boolean approved = decision == ReviewDecision.APPROVED;
        UUID entityId = requests.get(0).getId();
        RevampNotificationEvent event = notificationEventService.createPending(
                approved ? "document_renewal.outcome.approved.email" : "document_renewal.outcome.rejected.email",
                ENTITY_TYPE,
                entityId,
                recipient,
                null,
                null,
                "{\"applicationId\":\"" + esc(application != null && application.getId() != null ? application.getId().toString() : "")
                        + "\",\"decision\":\"" + esc(decision != null ? decision.name() : "")
                        + "\",\"documents\":" + toJsonArray(requests.stream().map(RevampDocumentRenewalRequest::getDocumentLabel).toList())
                        + ",\"reason\":\"" + esc(reason) + "\"}"
        );

        try {
            var message = javaMailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setTo(recipient);
            helper.setSubject(approved ? "Rinnovo documenti approvato" : "Rinnovo documenti respinto");
            helper.setText(buildBody(application, requests, approved, reason), false);
            javaMailSender.send(message);
            notificationEventService.markSent(event.getId(), null);
            log.info("Document-renewal outcome email sent to {} for {} request(s)", recipient, requests.size());
        } catch (Exception ex) {
            notificationEventService.markFailed(event.getId(), notificationEventService.failureReason(ex));
            log.error("Failed to send document-renewal outcome email to {}", recipient, ex);
        }
    }

    private String buildBody(RevampApplication application, List<RevampDocumentRenewalRequest> requests, boolean approved, String reason) {
        StringBuilder body = new StringBuilder();
        body.append("Gentile Fornitore,\n\n");
        body.append("il rinnovo dei documenti e stato ")
                .append(approved ? "approvato." : "respinto.")
                .append("\n\n");
        if (application != null && application.getProtocolCode() != null && !application.getProtocolCode().isBlank()) {
            body.append("Codice candidatura: ").append(application.getProtocolCode().trim()).append("\n");
        }
        body.append("Documenti:\n");
        for (RevampDocumentRenewalRequest request : requests) {
            body.append("- ").append(request.getDocumentLabel()).append("\n");
        }
        if (reason != null && !reason.isBlank()) {
            body.append("\nMotivazione: ").append(reason.trim()).append("\n");
        }
        if (!approved) {
            body.append("\nI valori precedentemente approvati restano attivi nel profilo.\n");
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

    private static String toJsonArray(List<String> items) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < items.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(esc(items.get(i))).append("\"");
        }
        sb.append("]");
        return sb.toString();
    }

    private static String esc(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
