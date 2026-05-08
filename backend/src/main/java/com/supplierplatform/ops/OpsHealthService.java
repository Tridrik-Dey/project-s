package com.supplierplatform.ops;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class OpsHealthService {

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.reminders.document-expiry.mail.enabled:false}")
    private boolean reminderMailEnabled;

    @Value("${app.reviews.status-mail.enabled:true}")
    private boolean reviewStatusMailEnabled;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    public OpsHealthService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public HealthSnapshot getHealthSnapshot() {
        boolean databaseUp = isDatabaseUp();
        boolean mailConfigValid = isMailConfigValid();
        boolean up = databaseUp && mailConfigValid;
        String status = up ? "UP" : "DEGRADED";
        return new HealthSnapshot(status, databaseUp, mailConfigValid);
    }

    private boolean isDatabaseUp() {
        try {
            Integer value = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return value != null && value == 1;
        } catch (Exception ex) {
            return false;
        }
    }

    private boolean isMailConfigValid() {
        if (!reminderMailEnabled && !reviewStatusMailEnabled) {
            return true;
        }
        return isPresent(mailUsername) && isPresent(mailPassword);
    }

    private boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    public record HealthSnapshot(
            String status,
            boolean databaseUp,
            boolean mailConfigValid
    ) {
    }
}
