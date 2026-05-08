package com.supplierplatform.revamp.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

@Component
public class SmtpConfigStore {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final Path configPath = Paths.get(System.getProperty("user.dir"), "smtp-config.json");

    private volatile String email;
    private volatile String password;

    @PostConstruct
    public void load() {
        if (!Files.exists(configPath)) return;
        try {
            var node = MAPPER.readTree(configPath.toFile());
            String e = node.path("email").asText(null);
            String p = node.path("password").asText(null);
            if (e != null && !e.isBlank()) { email = e; password = p; }
        } catch (IOException ignored) {}
    }

    public boolean hasConfig() {
        return email != null && !email.isBlank() && password != null && !password.isBlank();
    }

    public String getEmail() { return email; }
    public String getPassword() { return password; }

    public synchronized void save(String newEmail, String newPassword) throws IOException {
        MAPPER.writeValue(configPath.toFile(), Map.of("email", newEmail, "password", newPassword));
        this.email = newEmail;
        this.password = newPassword;
    }
}
