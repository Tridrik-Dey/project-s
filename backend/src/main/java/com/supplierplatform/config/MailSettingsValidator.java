package com.supplierplatform.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class MailSettingsValidator implements ApplicationRunner {

    @Value("${app.mail.fail-fast:false}")
    private boolean failFastEnabled;

    @Value("${app.reminders.document-expiry.mail.enabled:false}")
    private boolean reminderMailEnabled;

    @Value("${app.reviews.status-mail.enabled:true}")
    private boolean reviewStatusMailEnabled;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Override
    public void run(ApplicationArguments args) {
        if (!failFastEnabled) {
            return;
        }

        boolean anyMailFeatureEnabled = reminderMailEnabled || reviewStatusMailEnabled;
        if (!anyMailFeatureEnabled) {
            return;
        }

        if (isBlank(mailUsername) || isBlank(mailPassword)) {
            throw new IllegalStateException(
                    "Mail features are enabled but spring.mail.username/password are not configured. " +
                            "Set MAIL_USERNAME and MAIL_PASSWORD (or disable mail features)."
            );
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
