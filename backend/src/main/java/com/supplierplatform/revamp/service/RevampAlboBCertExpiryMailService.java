package com.supplierplatform.revamp.service;

import com.supplierplatform.config.CentralizedJavaMailSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class RevampAlboBCertExpiryMailService {

    private final JavaMailSender javaMailSender;
    private final CentralizedJavaMailSender centralizedJavaMailSender;

    @Value("${app.frontend.base-url:http://127.0.0.1:5173}")
    private String frontendBaseUrl;

    private static final DateTimeFormatter IT_MONTH = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ITALIAN);

    public record DispatchResult(boolean sent, String failureReason) {}

    public DispatchResult sendCertExpiryReminder(
            String recipientEmail,
            String companyName,
            YearMonth expiryMonth,
            List<String> certLabels) {

        String formattedMonth = expiryMonth.format(IT_MONTH);
        String certList = certLabels.stream()
                .map(l -> "  - " + l)
                .reduce("", (a, b) -> a + "\n" + b);

        String subject = "Promemoria: certificazioni in scadenza il mese prossimo";
        String body = """
                Gentile %s,

                ti informiamo che le seguenti certificazioni registrate sul portale scadranno nel mese di %s:
                %s

                Ti preghiamo di rinnovare i certificati e aggiornare i documenti sul portale prima della scadenza
                per mantenere attiva l'iscrizione all'Albo Fornitori (Albo B — Aziende).

                Accedi al portale: %s

                Se hai già provveduto al rinnovo, puoi ignorare questa comunicazione.

                Albo Fornitori Digitale
                """.formatted(
                companyName.isBlank() ? "azienda" : companyName,
                formattedMonth,
                certList,
                frontendBaseUrl);

        try {
            var message = javaMailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            helper.setTo(recipientEmail);
            helper.setFrom(centralizedJavaMailSender.effectiveFromAddress());
            helper.setSubject(subject);
            helper.setText(body, false);
            javaMailSender.send(message);
            log.info("Albo B cert expiry reminder sent to {} for month {}", recipientEmail, expiryMonth);
            return new DispatchResult(true, null);
        } catch (Exception ex) {
            log.error("Failed to send Albo B cert expiry reminder to {}", recipientEmail, ex);
            return new DispatchResult(false, ex.getClass().getSimpleName());
        }
    }
}
