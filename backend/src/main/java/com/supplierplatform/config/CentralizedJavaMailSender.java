package com.supplierplatform.config;

import com.supplierplatform.revamp.config.SmtpConfigStore;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessagePreparator;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.Properties;

@Component
@Primary
@RequiredArgsConstructor
public class CentralizedJavaMailSender implements JavaMailSender {

    private final SmtpConfigStore smtpConfigStore;

    @Value("${spring.mail.host:smtp.gmail.com}")
    private String mailHost;

    @Value("${spring.mail.port:587}")
    private int mailPort;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    public boolean hasConfiguredCredentials() {
        return smtpConfigStore.hasConfig() || (isPresent(mailUsername) && isPresent(mailPassword));
    }

    public String effectiveFromAddress() {
        if (smtpConfigStore.hasConfig()) {
            return smtpConfigStore.getEmail();
        }
        return isPresent(mailUsername) ? mailUsername.trim() : "no-reply@supplierplatform.local";
    }

    @Override
    public MimeMessage createMimeMessage() {
        return buildDelegate().createMimeMessage();
    }

    @Override
    public MimeMessage createMimeMessage(InputStream contentStream) throws MailException {
        return buildDelegate().createMimeMessage(contentStream);
    }

    @Override
    public void send(MimeMessage mimeMessage) throws MailException {
        applyFrom(mimeMessage);
        buildDelegate().send(mimeMessage);
    }

    @Override
    public void send(MimeMessage... mimeMessages) throws MailException {
        for (MimeMessage message : mimeMessages) {
            applyFrom(message);
        }
        buildDelegate().send(mimeMessages);
    }

    @Override
    public void send(MimeMessagePreparator mimeMessagePreparator) throws MailException {
        buildDelegate().send(wrapPreparator(mimeMessagePreparator));
    }

    @Override
    public void send(MimeMessagePreparator... mimeMessagePreparators) throws MailException {
        MimeMessagePreparator[] wrapped = new MimeMessagePreparator[mimeMessagePreparators.length];
        for (int i = 0; i < mimeMessagePreparators.length; i++) {
            wrapped[i] = wrapPreparator(mimeMessagePreparators[i]);
        }
        buildDelegate().send(wrapped);
    }

    @Override
    public void send(SimpleMailMessage simpleMessage) throws MailException {
        SimpleMailMessage copy = copyWithFrom(simpleMessage);
        buildDelegate().send(copy);
    }

    @Override
    public void send(SimpleMailMessage... simpleMessages) throws MailException {
        SimpleMailMessage[] copies = new SimpleMailMessage[simpleMessages.length];
        for (int i = 0; i < simpleMessages.length; i++) {
            copies[i] = copyWithFrom(simpleMessages[i]);
        }
        buildDelegate().send(copies);
    }

    private JavaMailSenderImpl buildDelegate() {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        if (smtpConfigStore.hasConfig()) {
            sender.setHost("smtp.gmail.com");
            sender.setPort(587);
            sender.setUsername(smtpConfigStore.getEmail());
            sender.setPassword(smtpConfigStore.getPassword());
        } else {
            sender.setHost(mailHost);
            sender.setPort(mailPort);
            sender.setUsername(mailUsername != null ? mailUsername : "");
            sender.setPassword(mailPassword != null ? mailPassword : "");
        }

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        return sender;
    }

    private MimeMessagePreparator wrapPreparator(MimeMessagePreparator preparator) {
        return mimeMessage -> {
            preparator.prepare(mimeMessage);
            applyFrom(mimeMessage);
        };
    }

    private void applyFrom(MimeMessage message) {
        try {
            message.setFrom(new InternetAddress(effectiveFromAddress()));
        } catch (MessagingException ex) {
            throw new IllegalStateException("Failed to apply centralized SMTP sender", ex);
        }
    }

    private SimpleMailMessage copyWithFrom(SimpleMailMessage message) {
        SimpleMailMessage copy = new SimpleMailMessage(message);
        copy.setFrom(effectiveFromAddress());
        return copy;
    }

    private boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }
}
