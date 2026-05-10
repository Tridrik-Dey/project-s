package com.supplierplatform.revamp.service;

import com.supplierplatform.revamp.dto.AdminUserInviteDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@Slf4j
public class RevampAdminInviteMailService {

    private final JavaMailSender javaMailSender;

    @Value("${app.frontend.base-url:http://127.0.0.1:5173}")
    private String frontendBaseUrl;

    public record InviteDispatchResult(boolean sent, String activationUrl, String failureReason) {}

    public InviteDispatchResult sendInvite(AdminUserInviteDto invite, String inviteToken) {
        String activationUrl = buildActivationUrl(inviteToken);
        String subject = "Invito accesso amministrativo - Albo Fornitori Digitale";
        String body = """
                Ciao %s,

                sei stato invitato ad accedere come utente amministrativo.

                Ruolo assegnato: %s
                Scadenza invito: %s

                Attiva il tuo account da questo link:
                %s

                Se non ti aspettavi questa email, ignora questo messaggio.
                """.formatted(
                invite.email(),
                invite.adminRole().name(),
                invite.inviteExpiresAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                activationUrl
        );

        try {
            var message = javaMailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setTo(invite.email());
            helper.setSubject(subject);
            helper.setText(body, false);
            javaMailSender.send(message);
            return new InviteDispatchResult(true, activationUrl, null);
        } catch (Exception ex) {
            log.error("Failed to send admin invite email to {}", invite.email(), ex);
            return new InviteDispatchResult(false, activationUrl, ex.getClass().getSimpleName());
        }
    }

    public String buildActivationUrl(String inviteToken) {
        String normalizedBase = frontendBaseUrl == null ? "" : frontendBaseUrl.trim().replaceAll("/+$", "");
        return normalizedBase + "/activate-account?token=" + inviteToken;
    }
}
