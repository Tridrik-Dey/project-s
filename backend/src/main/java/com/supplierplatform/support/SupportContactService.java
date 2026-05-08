package com.supplierplatform.support;

import com.supplierplatform.support.dto.SupportContactRequest;
import com.supplierplatform.validation.EmailValidators;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupportContactService {

    private final JavaMailSender javaMailSender;

    @Value("${app.support.contact.enabled:true}")
    private boolean supportContactEnabled;

    @Value("${app.support.contact.to:${spring.mail.username:}}")
    private String supportRecipient;

    @Value("${app.support.contact.from:${app.reviews.status-mail.from:${spring.mail.username:no-reply@supplierplatform.local}}}")
    private String fromEmail;

    @Value("${app.mail.retry.max-attempts:3}")
    private int mailRetryMaxAttempts;

    @Value("${app.mail.retry.backoff-ms:500}")
    private long mailRetryBackoffMs;

    public void submit(SupportContactRequest request) {
        if (!supportContactEnabled) {
            throw new IllegalStateException("Support contact is currently disabled.");
        }

        String normalizedEmail = EmailValidators.normalize(request.getEmail());
        if (!EmailValidators.hasValidDomainSuffix(normalizedEmail)) {
            throw new IllegalArgumentException("Support email must include a valid domain suffix (e.g. .com, .it)");
        }
        request.setEmail(normalizedEmail);

        if (!isPresent(supportRecipient)) {
            throw new IllegalStateException("Support destination email is not configured.");
        }

        if (!sendSupportEmailWithRetry(request)) {
            throw new IllegalStateException("Failed to send support contact email.");
        }

        if (!sendAutoReplyWithRetry(request)) {
            throw new IllegalStateException("Failed to send support confirmation email.");
        }
    }

    private boolean sendSupportEmailWithRetry(SupportContactRequest request) {
        int maxAttempts = Math.max(1, mailRetryMaxAttempts);
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                sendSupportEmail(request);
                return true;
            } catch (Exception ex) {
                if (attempt == maxAttempts) {
                    log.error("Support contact mail failed after {} attempts from {}: {}", maxAttempts, request.getEmail(), ex.getMessage(), ex);
                    return false;
                }
                log.warn("Support contact mail attempt {}/{} failed from {}: {}", attempt, maxAttempts, request.getEmail(), ex.getMessage());
                sleepBackoff();
            }
        }
        return false;
    }

    private boolean sendAutoReplyWithRetry(SupportContactRequest request) {
        int maxAttempts = Math.max(1, mailRetryMaxAttempts);
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                sendAutoReplyEmail(request);
                return true;
            } catch (Exception ex) {
                if (attempt == maxAttempts) {
                    log.error("Support confirmation mail failed after {} attempts to {}: {}", maxAttempts, request.getEmail(), ex.getMessage(), ex);
                    return false;
                }
                log.warn("Support confirmation mail attempt {}/{} failed to {}: {}", attempt, maxAttempts, request.getEmail(), ex.getMessage());
                sleepBackoff();
            }
        }
        return false;
    }

    private void sendSupportEmail(SupportContactRequest request) throws Exception {
        MimeMessage message = javaMailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
        helper.setFrom(fromEmail);
        helper.setTo(supportRecipient);
        helper.setReplyTo(request.getEmail());
        helper.setSubject(buildSupportSubject(request));
        helper.setText(buildSupportBody(request), false);
        javaMailSender.send(message);
    }

    private void sendAutoReplyEmail(SupportContactRequest request) throws Exception {
        MimeMessage message = javaMailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
        helper.setFrom(fromEmail);
        helper.setTo(request.getEmail());
        helper.setReplyTo(isPresent(supportRecipient) ? supportRecipient : fromEmail);
        helper.setSubject(buildAutoReplySubject(request));
        helper.setText(buildAutoReplyBody(request), false);
        javaMailSender.send(message);
    }

    private String buildSupportSubject(SupportContactRequest request) {
        String name = sanitizeSingleLine(request.getName());
        return "Support contact request - " + name;
    }

    private String buildSupportBody(SupportContactRequest request) {
        String language = isPresent(request.getLanguage()) ? sanitizeSingleLine(request.getLanguage()) : "n/a";
        String timestamp = LocalDateTime.now().toString();
        return """
                New support contact request

                Name: %s
                Email: %s
                UI Language: %s
                Created At: %s

                Message:
                %s
                """.formatted(
                sanitizeSingleLine(request.getName()),
                sanitizeSingleLine(request.getEmail()),
                language,
                timestamp,
                request.getMessage()
        );
    }

    private String buildAutoReplySubject(SupportContactRequest request) {
        boolean italian = isItalian(request.getLanguage());
        if (italian) {
            return "Conferma ricezione richiesta supporto";
        }
        return "Support request received confirmation";
    }

    private String buildAutoReplyBody(SupportContactRequest request) {
        String name = sanitizeSingleLine(request.getName());
        boolean italian = isItalian(request.getLanguage());
        if (italian) {
            return """
                    Gentile %s,

                    confermiamo di aver ricevuto il tuo messaggio di supporto.
                    Il team aziendale lo prendera in carico e rispondera nel piu breve tempo possibile.

                    Grazie,
                    Team Supporto
                    """.formatted(name);
        }
        return """
                Dear %s,

                we confirm that we have received your support message.
                The company team will review it and respond as soon as possible.

                Thank you,
                Support Team
                """.formatted(name);
    }

    private boolean isItalian(String language) {
        if (!isPresent(language)) {
            return false;
        }
        String normalized = language.trim().toLowerCase(Locale.ROOT);
        return normalized.startsWith("it");
    }

    private String sanitizeSingleLine(String value) {
        if (!isPresent(value)) {
            return "";
        }
        return value.replace("\r", " ").replace("\n", " ").trim();
    }

    private void sleepBackoff() {
        if (mailRetryBackoffMs <= 0) {
            return;
        }
        try {
            Thread.sleep(mailRetryBackoffMs);
        } catch (InterruptedException interruptedEx) {
            Thread.currentThread().interrupt();
        }
    }

    private boolean isPresent(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
