package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.supplierplatform.revamp.enums.RevampAttachmentDocumentType;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationAttachment;
import com.supplierplatform.revamp.repository.RevampApplicationAttachmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class RevampAttachmentService {

    private static final int EXPIRING_SOON_DAYS = 30;

    private final RevampApplicationAttachmentRepository attachmentRepository;

    @Transactional
    public JsonNode syncAndEnrich(
            RevampApplication application,
            String sectionKey,
            JsonNode payload
    ) {
        if (!(payload instanceof ObjectNode objectPayload)) {
            return payload;
        }

        List<RevampApplicationAttachment> attachments = switch (sectionKey) {
            case "S4" -> extractS4Attachments(application, objectPayload);
            case "S1" -> extractS1Attachments(application, objectPayload);
            default -> List.of();
        };

        if (!attachments.isEmpty() || "S4".equals(sectionKey) || "S1".equals(sectionKey)) {
            attachmentRepository.deleteByApplicationIdAndSectionKey(application.getId(), sectionKey);
            if (!attachments.isEmpty()) {
                attachmentRepository.saveAll(attachments);
            }
        }
        return objectPayload;
    }

    private List<RevampApplicationAttachment> extractS4Attachments(RevampApplication application, ObjectNode payload) {
        JsonNode node = payload.path("attachments");
        if (!node.isArray()) {
            return List.of();
        }

        ArrayNode attachmentsNode = (ArrayNode) node;
        List<RevampApplicationAttachment> out = new ArrayList<>();
        for (JsonNode item : attachmentsNode) {
            if (!(item instanceof ObjectNode attachmentNode)) continue;

            String fileName = attachmentNode.path("fileName").asText("").trim();
            String storageKey = attachmentNode.path("storageKey").asText("").trim();
            if (fileName.isBlank() || storageKey.isBlank()) continue;

            RevampAttachmentDocumentType type = parseDocumentType(attachmentNode.path("documentType").asText(""));
            LocalDateTime expiresAt = parseDateTime(attachmentNode.path("expiresAt").asText(""));

            upsertExpiryFlags(attachmentNode, expiresAt);
            attachmentNode.put("documentType", type.name());

            RevampApplicationAttachment attachment = new RevampApplicationAttachment();
            attachment.setApplication(application);
            attachment.setSectionKey("S4");
            attachment.setDocumentType(type);
            attachment.setFileName(fileName);
            attachment.setMimeType(blankToNull(attachmentNode.path("mimeType").asText("")));
            attachment.setSizeBytes(parseLong(attachmentNode.path("sizeBytes").asText("")));
            attachment.setStorageKey(storageKey);
            attachment.setExpiresAt(expiresAt);
            out.add(attachment);
        }
        return out;
    }

    private List<RevampApplicationAttachment> extractS1Attachments(RevampApplication application, ObjectNode payload) {
        if (application.getRegistryType() == RegistryType.ALBO_B) {
            return extractAlboBLegalRepIdAttachment(application, payload);
        }
        return extractAlboAIdAttachment(application, payload);
    }

    private List<RevampApplicationAttachment> extractAlboAIdAttachment(RevampApplication application, ObjectNode payload) {
        JsonNode photoNode = payload.path("profilePhotoAttachment");
        if (!(photoNode instanceof ObjectNode photo)) {
            return List.of();
        }

        String fileName = photo.path("fileName").asText("").trim();
        String storageKey = photo.path("storageKey").asText("").trim();
        if (fileName.isBlank() || storageKey.isBlank()) {
            return List.of();
        }

        RevampAttachmentDocumentType type = parseDocumentType(photo.path("documentType").asText("OTHER"));
        LocalDateTime expiresAt = parseDateTime(firstNonBlank(photo.path("expiresAt").asText(""), payload.path("idDocumentExpiry").asText("")));
        photo.put("documentType", type.name());
        if (expiresAt != null) {
            photo.put("expiresAt", expiresAt.toLocalDate().toString());
        }
        upsertExpiryFlags(photo, expiresAt);

        RevampApplicationAttachment attachment = new RevampApplicationAttachment();
        attachment.setApplication(application);
        attachment.setSectionKey("S1");
        attachment.setFieldKey("profilePhotoAttachment");
        attachment.setDocumentType(type);
        attachment.setFileName(fileName);
        attachment.setMimeType(blankToNull(photo.path("mimeType").asText("")));
        attachment.setSizeBytes(parseLong(photo.path("sizeBytes").asText("")));
        attachment.setStorageKey(storageKey);
        attachment.setExpiresAt(expiresAt);
        return List.of(attachment);
    }

    private List<RevampApplicationAttachment> extractAlboBLegalRepIdAttachment(RevampApplication application, ObjectNode payload) {
        JsonNode representativeNode = payload.path("legalRepresentative");
        if (!(representativeNode instanceof ObjectNode representative)) {
            return List.of();
        }
        JsonNode attachmentNode = representative.path("idDocumentAttachment");
        if (!(attachmentNode instanceof ObjectNode attachmentJson)) {
            attachmentNode = payload.path("lrCartaIdentita");
        }
        if (!(attachmentNode instanceof ObjectNode document)) {
            return List.of();
        }

        String fileName = document.path("fileName").asText("").trim();
        String storageKey = document.path("storageKey").asText("").trim();
        if (fileName.isBlank() || storageKey.isBlank()) {
            return List.of();
        }

        RevampAttachmentDocumentType type = parseDocumentType(document.path("documentType").asText("OTHER"));
        LocalDateTime expiresAt = parseDateTime(firstNonBlank(
                document.path("expiresAt").asText(""),
                representative.path("idDocumentExpiry").asText(""),
                payload.path("lrIdDocumentExpiry").asText("")
        ));
        document.put("documentType", type.name());
        if (expiresAt != null) {
            document.put("expiresAt", expiresAt.toLocalDate().toString());
        }
        upsertExpiryFlags(document, expiresAt);
        representative.set("idDocumentAttachment", document);
        payload.set("legalRepresentative", representative);
        payload.set("lrCartaIdentita", document);

        RevampApplicationAttachment attachment = new RevampApplicationAttachment();
        attachment.setApplication(application);
        attachment.setSectionKey("S1");
        attachment.setFieldKey("legalRepresentative.idDocumentAttachment");
        attachment.setDocumentType(type);
        attachment.setFileName(fileName);
        attachment.setMimeType(blankToNull(document.path("mimeType").asText("")));
        attachment.setSizeBytes(parseLong(document.path("sizeBytes").asText("")));
        attachment.setStorageKey(storageKey);
        attachment.setExpiresAt(expiresAt);
        return List.of(attachment);
    }

    private void upsertExpiryFlags(ObjectNode attachmentNode, LocalDateTime expiresAt) {
        if (expiresAt == null) {
            attachmentNode.put("expired", false);
            attachmentNode.put("expiringSoon", false);
            return;
        }
        LocalDate today = LocalDate.now();
        LocalDate expiryDate = expiresAt.toLocalDate();
        boolean expired = expiryDate.isBefore(today);
        boolean expiringSoon = !expired && !expiryDate.isAfter(today.plusDays(EXPIRING_SOON_DAYS));
        attachmentNode.put("expired", expired);
        attachmentNode.put("expiringSoon", expiringSoon);
    }

    private RevampAttachmentDocumentType parseDocumentType(String raw) {
        String normalized = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return RevampAttachmentDocumentType.OTHER;
        }
        try {
            return RevampAttachmentDocumentType.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            return RevampAttachmentDocumentType.OTHER;
        }
    }

    private Long parseLong(String raw) {
        String value = blankToNull(raw);
        if (value == null) return null;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private LocalDateTime parseDateTime(String raw) {
        String value = blankToNull(raw);
        if (value == null) return null;
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException ignored) {
        }
        try {
            return OffsetDateTime.parse(value).toLocalDateTime();
        } catch (DateTimeParseException ignored) {
        }
        try {
            return LocalDate.parse(value).atStartOfDay();
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private String blankToNull(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String firstNonBlank(String... values) {
        if (values == null) return "";
        for (String value : values) {
            String normalized = blankToNull(value);
            if (normalized != null) return normalized;
        }
        return "";
    }
}
