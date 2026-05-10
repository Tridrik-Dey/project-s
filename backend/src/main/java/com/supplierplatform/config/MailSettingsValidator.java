package com.supplierplatform.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class MailSettingsValidator implements ApplicationRunner {

    private final CentralizedJavaMailSender centralizedJavaMailSender;

    public MailSettingsValidator(CentralizedJavaMailSender centralizedJavaMailSender) {
        this.centralizedJavaMailSender = centralizedJavaMailSender;
    }

    @Value("${app.mail.fail-fast:false}")
    private boolean failFastEnabled;

    @Value("${app.reminders.document-expiry.mail.enabled:false}")
    private boolean reminderMailEnabled;

    @Value("${app.reviews.status-mail.enabled:true}")
    private boolean reviewStatusMailEnabled;

    @Override
    public void run(ApplicationArguments args) {
        if (!failFastEnabled) {
            return;
        }

        boolean anyMailFeatureEnabled = reminderMailEnabled || reviewStatusMailEnabled;
        if (!anyMailFeatureEnabled) {
            return;
        }

        if (!centralizedJavaMailSender.hasConfiguredCredentials()) {
            throw new IllegalStateException(
                    "Mail features are enabled but spring.mail.username/password are not configured. " +
                            "Set SMTP config or MAIL_USERNAME and MAIL_PASSWORD (or disable mail features)."
            );
        }
    }
}
