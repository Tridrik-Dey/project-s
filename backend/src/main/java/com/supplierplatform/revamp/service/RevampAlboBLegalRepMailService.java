package com.supplierplatform.revamp.service;

import com.supplierplatform.config.CentralizedJavaMailSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
@Slf4j
public class RevampAlboBLegalRepMailService {

    private final JavaMailSender javaMailSender;
    private final CentralizedJavaMailSender centralizedJavaMailSender;

    @Value("${app.frontend.base-url:http://127.0.0.1:5173}")
    private String frontendBaseUrl;

    private static final DateTimeFormatter IT_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public record DispatchResult(boolean sent, String failureReason) {}

    public DispatchResult sendExpiryReminder(String recipientEmail, String companyName, LocalDate expiryDate) {
        String formattedDate = expiryDate.format(IT_DATE);
        String subject = "Promemoria: la carta d'identità del legale rappresentante scade tra 30 giorni";
        String body = """
                Gentile %s,

                ti informiamo che la carta d'identità del legale rappresentante registrata sul portale scadrà tra 30 giorni.

                Data di scadenza: %s

                Ti preghiamo di aggiornare il documento accedendo al portale prima della scadenza per mantenere
                attiva l'iscrizione all'Albo Fornitori (Albo B — Aziende).

                Accedi al portale: %s

                Se hai già provveduto all'aggiornamento, puoi ignorare questa comunicazione.

                Albo Fornitori Digitale
                """.formatted(companyName.isBlank() ? "azienda" : companyName, formattedDate, frontendBaseUrl);

        try {
            var message = javaMailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setTo(recipientEmail);
            helper.setFrom(centralizedJavaMailSender.effectiveFromAddress());
            helper.setSubject(subject);
            helper.setText(body, false);
            javaMailSender.send(message);
            log.info("Albo B legal rep ID expiry reminder sent to {}", recipientEmail);
            return new DispatchResult(true, null);
        } catch (Exception ex) {
            log.error("Failed to send Albo B legal rep ID expiry reminder to {}", recipientEmail, ex);
            return new DispatchResult(false, ex.getClass().getSimpleName());
        }
    }
}
