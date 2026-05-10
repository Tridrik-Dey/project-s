package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.config.CentralizedJavaMailSender;
import com.supplierplatform.revamp.config.SmtpConfigStore;
import com.supplierplatform.revamp.dto.OtpChallengeDispatchDto;
import com.supplierplatform.revamp.dto.OtpChallengeVerifyDto;
import com.supplierplatform.revamp.enums.OtpChallengeStatus;
import com.supplierplatform.revamp.enums.OtpChallengeType;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import com.supplierplatform.revamp.model.RevampOtpChallenge;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampOtpChallengeRepository;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class RevampOtpChallengeService {

    private final RevampOtpChallengeRepository otpChallengeRepository;
    private final RevampApplicationRepository applicationRepository;
    private final RevampApplicationSectionRepository applicationSectionRepository;
    private final JavaMailSender javaMailSender;
    private final CentralizedJavaMailSender centralizedJavaMailSender;
    private final SmtpConfigStore smtpConfigStore;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public OtpChallengeDispatchDto dispatchDeclarationSignatureOtp(UUID applicationId, User user) {
        RevampApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampApplication", applicationId));
        if (application.getApplicantUser() == null || user.getId() == null || !user.getId().equals(application.getApplicantUser().getId())) {
            throw new IllegalStateException("Application does not belong to current user");
        }

        List<RevampOtpChallenge> pending = otpChallengeRepository.findByUserIdAndChallengeTypeAndStatusOrderByCreatedAtDesc(
                user.getId(),
                OtpChallengeType.DECLARATION_SIGNATURE,
                OtpChallengeStatus.PENDING
        );
        for (RevampOtpChallenge challenge : pending) {
            challenge.setStatus(OtpChallengeStatus.EXPIRED);
            otpChallengeRepository.save(challenge);
        }

        String code = String.format("%06d", ThreadLocalRandom.current().nextInt(0, 1_000_000));
        RevampOtpChallenge challenge = new RevampOtpChallenge();
        challenge.setApplication(application);
        challenge.setUser(user);
        challenge.setChallengeType(OtpChallengeType.DECLARATION_SIGNATURE);
        challenge.setTargetEmail(user.getEmail());
        challenge.setOtpHash(hash(code));
        challenge.setAttempts(0);
        challenge.setMaxAttempts(5);
        challenge.setExpiresAt(LocalDateTime.now().plusMinutes(15));
        challenge.setStatus(OtpChallengeStatus.PENDING);
        RevampOtpChallenge saved = otpChallengeRepository.save(challenge);

        String deliveryMode = "SENT";
        String debugCode = null;
        if (simulateOtpDelivery()) {
            deliveryMode = "SIMULATED";
            debugCode = code;
        } else {
            try {
                sendOtpEmail(user.getEmail(), code, saved.getExpiresAt());
            } catch (Exception ex) {
                throw otpDeliveryFailure(ex);
            }
        }

        return new OtpChallengeDispatchDto(
                saved.getId(),
                saved.getExpiresAt(),
                saved.getStatus().name(),
                deliveryMode,
                maskEmail(user.getEmail()),
                debugCode
        );
    }

    @Transactional
    public OtpChallengeDispatchDto dispatchEmailVerificationOtp(User user) {
        List<RevampOtpChallenge> pending = otpChallengeRepository.findByUserIdAndChallengeTypeAndStatusOrderByCreatedAtDesc(
                user.getId(),
                OtpChallengeType.EMAIL_VERIFY,
                OtpChallengeStatus.PENDING
        );
        for (RevampOtpChallenge challenge : pending) {
            challenge.setStatus(OtpChallengeStatus.EXPIRED);
            otpChallengeRepository.save(challenge);
        }

        String code = String.format("%06d", ThreadLocalRandom.current().nextInt(0, 1_000_000));
        RevampOtpChallenge challenge = new RevampOtpChallenge();
        challenge.setApplication(null);
        challenge.setUser(user);
        challenge.setChallengeType(OtpChallengeType.EMAIL_VERIFY);
        challenge.setTargetEmail(user.getEmail());
        challenge.setOtpHash(hash(code));
        challenge.setAttempts(0);
        challenge.setMaxAttempts(5);
        challenge.setExpiresAt(LocalDateTime.now().plusMinutes(15));
        challenge.setStatus(OtpChallengeStatus.PENDING);
        RevampOtpChallenge saved = otpChallengeRepository.save(challenge);

        String deliveryMode = "SENT";
        String debugCode = null;
        if (simulateOtpDelivery()) {
            deliveryMode = "SIMULATED";
            debugCode = code;
        } else {
            try {
                sendEmailVerificationOtpEmail(user.getEmail(), code, saved.getExpiresAt());
            } catch (Exception ex) {
                throw otpDeliveryFailure(ex);
            }
        }

        return new OtpChallengeDispatchDto(
                saved.getId(),
                saved.getExpiresAt(),
                saved.getStatus().name(),
                deliveryMode,
                maskEmail(user.getEmail()),
                debugCode
        );
    }

    @Transactional
    public OtpChallengeVerifyDto verifyChallenge(UUID challengeId, String otpCode, User user) {
        RevampOtpChallenge challenge = otpChallengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("RevampOtpChallenge", challengeId));

        if (challenge.getUser() == null || user.getId() == null || !user.getId().equals(challenge.getUser().getId())) {
            throw new IllegalStateException("OTP challenge does not belong to current user");
        }
        if (challenge.getStatus() != OtpChallengeStatus.PENDING) {
            throw new IllegalStateException("OTP challenge is not pending");
        }

        if (LocalDateTime.now().isAfter(challenge.getExpiresAt())) {
            challenge.setStatus(OtpChallengeStatus.EXPIRED);
            otpChallengeRepository.save(challenge);
            throw new IllegalStateException("OTP challenge expired");
        }

        Integer attempts = challenge.getAttempts() == null ? 0 : challenge.getAttempts();
        Integer maxAttempts = challenge.getMaxAttempts() == null ? 5 : challenge.getMaxAttempts();
        if (attempts >= maxAttempts) {
            challenge.setStatus(OtpChallengeStatus.LOCKED);
            otpChallengeRepository.save(challenge);
            throw new IllegalStateException("OTP challenge locked");
        }

        String normalized = otpCode == null ? "" : otpCode.trim();
        boolean verified = hash(normalized).equals(challenge.getOtpHash());
        if (!verified) {
            attempts = attempts + 1;
            challenge.setAttempts(attempts);
            if (attempts >= maxAttempts) {
                challenge.setStatus(OtpChallengeStatus.LOCKED);
            }
            otpChallengeRepository.save(challenge);
            throw new IllegalArgumentException("Invalid OTP code");
        }

        challenge.setStatus(OtpChallengeStatus.VERIFIED);
        challenge.setVerifiedAt(LocalDateTime.now());
        RevampOtpChallenge saved = otpChallengeRepository.save(challenge);
        if (saved.getChallengeType() == OtpChallengeType.DECLARATION_SIGNATURE) {
            bindDeclarationSnapshot(saved);
        }
        return new OtpChallengeVerifyDto(
                saved.getId(),
                true,
                saved.getStatus().name(),
                saved.getAttempts(),
                saved.getMaxAttempts(),
                saved.getVerifiedAt()
        );
    }

    @Transactional
    public OtpChallengeVerifyDto verifyEmailChallenge(UUID challengeId, String otpCode, User user) {
        RevampOtpChallenge challenge = otpChallengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("RevampOtpChallenge", challengeId));
        if (challenge.getChallengeType() != OtpChallengeType.EMAIL_VERIFY) {
            throw new IllegalArgumentException("OTP challenge type mismatch");
        }
        OtpChallengeVerifyDto result = verifyChallenge(challengeId, otpCode, user);
        // Persist email verification so the supplier is not asked again on future logins
        userRepository.findById(user.getId()).ifPresent(u -> {
            u.setEmailVerified(true);
            userRepository.save(u);
        });
        return result;
    }

    @Transactional
    public OtpChallengeDispatchDto dispatchPasswordResetOtp(String email) {
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email.trim());
        if (userOpt.isEmpty()) {
            // Return a plausible fake response to prevent user enumeration
            return new OtpChallengeDispatchDto(UUID.randomUUID(), LocalDateTime.now().plusMinutes(15),
                    OtpChallengeStatus.PENDING.name(), "SIMULATED", maskEmail(email), null);
        }
        User user = userOpt.get();

        List<RevampOtpChallenge> pending = otpChallengeRepository.findByUserIdAndChallengeTypeAndStatusOrderByCreatedAtDesc(
                user.getId(), OtpChallengeType.PASSWORD_RESET, OtpChallengeStatus.PENDING);
        for (RevampOtpChallenge c : pending) {
            c.setStatus(OtpChallengeStatus.EXPIRED);
            otpChallengeRepository.save(c);
        }

        String code = String.format("%06d", ThreadLocalRandom.current().nextInt(0, 1_000_000));
        RevampOtpChallenge challenge = new RevampOtpChallenge();
        challenge.setUser(user);
        challenge.setChallengeType(OtpChallengeType.PASSWORD_RESET);
        challenge.setTargetEmail(user.getEmail());
        challenge.setOtpHash(hash(code));
        challenge.setAttempts(0);
        challenge.setMaxAttempts(5);
        challenge.setExpiresAt(LocalDateTime.now().plusMinutes(15));
        challenge.setStatus(OtpChallengeStatus.PENDING);
        RevampOtpChallenge saved = otpChallengeRepository.save(challenge);

        String deliveryMode = "SENT";
        String debugCode = null;
        if (simulateOtpDelivery()) {
            deliveryMode = "SIMULATED";
            debugCode = code;
        } else {
            try {
                sendPasswordResetOtpEmail(user.getEmail(), code, saved.getExpiresAt());
            } catch (Exception ex) {
                throw otpDeliveryFailure(ex);
            }
        }

        return new OtpChallengeDispatchDto(saved.getId(), saved.getExpiresAt(),
                saved.getStatus().name(), deliveryMode, maskEmail(user.getEmail()), debugCode);
    }

    @Transactional
    public void verifyPasswordResetChallenge(UUID challengeId, String otpCode, String newPassword) {
        RevampOtpChallenge challenge = otpChallengeRepository.findById(challengeId)
                .orElseThrow(() -> new EntityNotFoundException("RevampOtpChallenge", challengeId));

        if (challenge.getChallengeType() != OtpChallengeType.PASSWORD_RESET) {
            throw new IllegalArgumentException("OTP challenge type mismatch");
        }
        if (challenge.getStatus() != OtpChallengeStatus.PENDING) {
            throw new IllegalStateException("OTP challenge is not pending");
        }
        if (LocalDateTime.now().isAfter(challenge.getExpiresAt())) {
            challenge.setStatus(OtpChallengeStatus.EXPIRED);
            otpChallengeRepository.save(challenge);
            throw new IllegalStateException("OTP challenge expired");
        }

        int attempts = challenge.getAttempts() == null ? 0 : challenge.getAttempts();
        int maxAttempts = challenge.getMaxAttempts() == null ? 5 : challenge.getMaxAttempts();
        if (attempts >= maxAttempts) {
            challenge.setStatus(OtpChallengeStatus.LOCKED);
            otpChallengeRepository.save(challenge);
            throw new IllegalStateException("OTP challenge locked");
        }

        String normalized = otpCode == null ? "" : otpCode.trim();
        if (!hash(normalized).equals(challenge.getOtpHash())) {
            challenge.setAttempts(attempts + 1);
            if (attempts + 1 >= maxAttempts) {
                challenge.setStatus(OtpChallengeStatus.LOCKED);
            }
            otpChallengeRepository.save(challenge);
            throw new IllegalArgumentException("Invalid OTP code");
        }

        challenge.setStatus(OtpChallengeStatus.VERIFIED);
        challenge.setVerifiedAt(LocalDateTime.now());
        otpChallengeRepository.save(challenge);

        User user = challenge.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    private void sendPasswordResetOtpEmail(String to, String code, LocalDateTime expiresAt) throws Exception {
        MimeMessage message = javaMailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
        helper.setTo(to);
        helper.setSubject("Codice OTP reimpostazione password");
        String body = """
                Il tuo codice OTP per reimpostare la password e: %s

                Il codice scade alle %s.
                Se non hai richiesto il reset della password, ignora questa email.
                """.formatted(code, expiresAt);
        helper.setText(body, false);
        javaMailSender.send(message);
    }

    private boolean simulateOtpDelivery() {
        return smtpConfigStore.isDebugOtpEnabled() || !centralizedJavaMailSender.hasConfiguredCredentials();
    }

    private IllegalStateException otpDeliveryFailure(Exception ex) {
        return new IllegalStateException("OTP email could not be sent. Check SMTP settings or enable OTP debug mode.", ex);
    }

    private void sendOtpEmail(String to, String code, LocalDateTime expiresAt) throws Exception {
        MimeMessage message = javaMailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
        helper.setTo(to);
        helper.setSubject("Codice OTP firma candidatura");
        String body = """
                Il tuo codice OTP per la firma della candidatura e: %s

                Il codice scade alle %s.
                """.formatted(code, expiresAt);
        helper.setText(body, false);
        javaMailSender.send(message);
    }

    private void sendEmailVerificationOtpEmail(String to, String code, LocalDateTime expiresAt) throws Exception {
        MimeMessage message = javaMailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
        helper.setTo(to);
        helper.setSubject("Codice OTP verifica email");
        String body = """
                Il tuo codice OTP per verificare l'indirizzo email e: %s

                Il codice scade alle %s.
                """.formatted(code, expiresAt);
        helper.setText(body, false);
        javaMailSender.send(message);
    }

    private static String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hashed) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private static String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "n/a";
        String[] parts = email.split("@", 2);
        if (parts[0].length() <= 2) return "***@" + parts[1];
        return parts[0].charAt(0) + "***" + parts[0].charAt(parts[0].length() - 1) + "@" + parts[1];
    }

    private void bindDeclarationSnapshot(RevampOtpChallenge challenge) {
        RevampApplication application = challenge.getApplication();
        if (application == null || application.getId() == null) {
            throw new IllegalStateException("Declaration OTP challenge has no linked application");
        }

        RevampApplicationSection s5Section = applicationSectionRepository
                .findByApplicationIdAndSectionKeyAndIsLatestTrue(application.getId(), "S5")
                .orElseThrow(() -> new IllegalStateException("S5 section not found for declaration OTP verification"));

        if (!(s5Section.getPayloadJson() instanceof ObjectNode payloadObject)) {
            throw new IllegalStateException("S5 payload must be a JSON object for declaration signature binding");
        }

        String snapshotHash = hash(computeDeclarationSnapshotJson(payloadObject, application.getRegistryType()));
        payloadObject.put("declarationSnapshotHash", snapshotHash);
        payloadObject.put("declarationSnapshotSectionVersion", s5Section.getSectionVersion());
        payloadObject.put("otpChallengeId", challenge.getId().toString());
        payloadObject.put("otpVerified", true);
        payloadObject.put("otpVerifiedAt", challenge.getVerifiedAt().atOffset(ZoneOffset.UTC).toString());

        s5Section.setPayloadJson(payloadObject);
        applicationSectionRepository.save(s5Section);
    }

    private String computeDeclarationSnapshotJson(ObjectNode payload, RegistryType registryType) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("registryType", registryType != null ? registryType.name() : null);
        snapshot.put("truthfulnessDeclaration", payload.path("truthfulnessDeclaration").asBoolean(false));
        snapshot.put("noConflictOfInterest", payload.path("noConflictOfInterest").asBoolean(false));
        snapshot.put("noCriminalConvictions", payload.path("noCriminalConvictions").asBoolean(false));
        snapshot.put("privacyAccepted", payload.path("privacyAccepted").asBoolean(false));
        snapshot.put("ethicalCodeAccepted", payload.path("ethicalCodeAccepted").asBoolean(false));
        snapshot.put("qualityEnvSafetyAccepted", payload.path("qualityEnvSafetyAccepted").asBoolean(false));
        snapshot.put("alboDataProcessingConsent", payload.path("alboDataProcessingConsent").asBoolean(false));
        snapshot.put("marketingConsent", payload.path("marketingConsent").asBoolean(false));
        snapshot.put("dlgs81ComplianceWhenInPresence", payload.path("dlgs81ComplianceWhenInPresence").asBoolean(false));

        if (registryType == RegistryType.ALBO_B) {
            snapshot.put("antimafiaDeclaration", payload.path("antimafiaDeclaration").asBoolean(false));
            snapshot.put("dlgs231Declaration", payload.path("dlgs231Declaration").asBoolean(false));
            snapshot.put("model231Adopted", payload.path("model231Adopted").asBoolean(false));
            snapshot.put("fiscalContributionRegularity", payload.path("fiscalContributionRegularity").asBoolean(false));
            snapshot.put("gdprComplianceAndDpo", payload.path("gdprComplianceAndDpo").asBoolean(false));
        }

        try {
            return objectMapper.writeValueAsString(snapshot);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize declaration snapshot payload", ex);
        }
    }
}
