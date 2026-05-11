package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.supplierplatform.revamp.enums.RegistryType;

final class RevampDocumentRenewalJson {

    private RevampDocumentRenewalJson() {
    }

    static JsonNode findMatchingAttachment(JsonNode payload, String documentType, String certificationKey) {
        if (payload == null) return null;
        JsonNode attachments = payload.path("attachments");
        if (!attachments.isArray()) return null;
        for (JsonNode att : attachments) {
            if (matches(att, documentType, certificationKey)) {
                return att;
            }
        }
        return null;
    }

    static JsonNode findMatchingDocument(JsonNode payload, RegistryType registryType, String sectionKey, String documentType, String certificationKey) {
        if (payload == null) return null;
        if ("S1".equals(sectionKey) && "ID_DOCUMENT".equals(documentType)) {
            if (registryType == RegistryType.ALBO_B) {
                JsonNode nested = payload.path("legalRepresentative").path("idDocumentAttachment");
                if (!nested.isMissingNode() && !nested.isNull()) return nested;
                JsonNode legacy = payload.path("lrCartaIdentita");
                return legacy.isMissingNode() ? null : legacy;
            }
            JsonNode attachment = payload.path("profilePhotoAttachment");
            return attachment.isMissingNode() ? null : attachment;
        }
        return findMatchingAttachment(payload, documentType, certificationKey);
    }

    static JsonNode findCertificationRecord(JsonNode payload, String certificationKey) {
        if (payload == null || certificationKey == null || certificationKey.isBlank()) return null;
        JsonNode record = payload.path("certificazioni").path(certificationKey);
        return record.isMissingNode() || record.isNull() ? null : record;
    }

    static boolean isCertificationDeclined(JsonNode payload, String certificationKey) {
        JsonNode record = findCertificationRecord(payload, certificationKey);
        return record != null && "no".equalsIgnoreCase(record.path("presente").asText(""));
    }

    static JsonNode findRenewalEvidence(JsonNode payload, RegistryType registryType, String sectionKey, String documentType, String certificationKey) {
        if ("S4".equals(sectionKey)
                && "CERTIFICATION".equals(documentType)
                && certificationKey != null
                && !certificationKey.isBlank()
                && isCertificationDeclined(payload, certificationKey)) {
            return findCertificationRecord(payload, certificationKey);
        }
        return findMatchingDocument(payload, registryType, sectionKey, documentType, certificationKey);
    }

    static JsonNode mergeCertificationRenewal(ObjectMapper objectMapper, JsonNode currentPayload, JsonNode incomingPayload, String certificationKey) {
        if (currentPayload == null || !currentPayload.isObject() || incomingPayload == null || !incomingPayload.isObject()) {
            return currentPayload;
        }
        JsonNode incomingRecord = findCertificationRecord(incomingPayload, certificationKey);
        JsonNode incomingAttachment = findMatchingAttachment(incomingPayload, "CERTIFICATION", certificationKey);
        if ((incomingRecord == null || incomingRecord.isMissingNode() || incomingRecord.isNull())
                && (incomingAttachment == null || incomingAttachment.isMissingNode() || incomingAttachment.isNull())) {
            return currentPayload;
        }

        ObjectNode copy = currentPayload.deepCopy();
        if (incomingRecord != null && incomingRecord.isObject()) {
            ObjectNode certifications = copy.path("certificazioni").isObject()
                    ? (ObjectNode) copy.path("certificazioni").deepCopy()
                    : objectMapper.createObjectNode();
            ObjectNode nextRecord = certifications.path(certificationKey).isObject()
                    ? (ObjectNode) certifications.path(certificationKey).deepCopy()
                    : objectMapper.createObjectNode();
            if ("no".equalsIgnoreCase(incomingRecord.path("presente").asText(""))) {
                nextRecord.put("presente", "no");
                nextRecord.put("enteCertificatore", "");
                nextRecord.put("scadenza", "");
                nextRecord.put("fileName", "");
                nextRecord.set("attachment", objectMapper.nullNode());
                certifications.set(certificationKey, nextRecord);
                copy.set("certificazioni", certifications);
                syncLegacyCertificationFlag(copy, certificationKey, false);
                removeMatchingAttachment(copy, objectMapper, "CERTIFICATION", certificationKey);
                return copy;
            }
            certifications.set(certificationKey, incomingRecord.deepCopy());
            copy.set("certificazioni", certifications);
            syncLegacyCertificationFlag(copy, certificationKey, true);
        }

        if (incomingAttachment != null && incomingAttachment.isObject()) {
            return replaceMatchingAttachment(objectMapper, copy, "CERTIFICATION", certificationKey, incomingAttachment);
        }
        return copy;
    }

    private static void removeMatchingAttachment(ObjectNode payload, ObjectMapper objectMapper, String documentType, String certificationKey) {
        ArrayNode next = objectMapper.createArrayNode();
        JsonNode attachments = payload.path("attachments");
        if (attachments.isArray()) {
            for (JsonNode att : attachments) {
                if (!matches(att, documentType, certificationKey)) {
                    next.add(att);
                }
            }
        }
        payload.set("attachments", next);
    }

    static JsonNode replaceMatchingAttachment(
            ObjectMapper objectMapper,
            JsonNode currentPayload,
            String documentType,
            String certificationKey,
            JsonNode replacement
    ) {
        if (currentPayload == null || !currentPayload.isObject()) return currentPayload;
        ObjectNode copy = currentPayload.deepCopy();
        ArrayNode next = objectMapper.createArrayNode();
        boolean replaced = false;
        JsonNode attachments = copy.path("attachments");
        if (attachments.isArray()) {
            for (JsonNode att : attachments) {
                if (matches(att, documentType, certificationKey)) {
                    next.add(replacement);
                    replaced = true;
                } else {
                    next.add(att);
                }
            }
        }
        if (!replaced && replacement != null && replacement.isObject()) {
            next.add(replacement);
        }
        copy.set("attachments", next);
        return copy;
    }

    static JsonNode replaceMatchingDocument(
            ObjectMapper objectMapper,
            JsonNode currentPayload,
            RegistryType registryType,
            String sectionKey,
            String documentType,
            String certificationKey,
            JsonNode replacement
    ) {
        if (currentPayload == null || !currentPayload.isObject()) return currentPayload;
        if ("S1".equals(sectionKey) && "ID_DOCUMENT".equals(documentType)) {
            ObjectNode copy = currentPayload.deepCopy();
            if (registryType == RegistryType.ALBO_B) {
                ObjectNode representative = copy.path("legalRepresentative").isObject()
                        ? (ObjectNode) copy.path("legalRepresentative").deepCopy()
                        : objectMapper.createObjectNode();
                representative.set("idDocumentAttachment", replacement);
                copy.set("legalRepresentative", representative);
                copy.set("lrCartaIdentita", replacement);
                return copy;
            }
            copy.set("profilePhotoAttachment", replacement);
            return copy;
        }
        return replaceMatchingAttachment(objectMapper, currentPayload, documentType, certificationKey, replacement);
    }

    static JsonNode restoreCertificationRenewal(ObjectMapper objectMapper, JsonNode currentPayload, String certificationKey, JsonNode oldAttachment) {
        JsonNode restored = replaceMatchingAttachment(objectMapper, currentPayload, "CERTIFICATION", certificationKey, oldAttachment);
        if (restored == null || !restored.isObject()) return restored;
        ObjectNode copy = restored.deepCopy();
        ObjectNode certifications = copy.path("certificazioni").isObject()
                ? (ObjectNode) copy.path("certificazioni").deepCopy()
                : objectMapper.createObjectNode();
        ObjectNode record = certifications.path(certificationKey).isObject()
                ? (ObjectNode) certifications.path(certificationKey).deepCopy()
                : objectMapper.createObjectNode();
        record.put("presente", "si");
        if (oldAttachment != null && oldAttachment.isObject()) {
            if (oldAttachment.hasNonNull("fileName")) record.put("fileName", oldAttachment.path("fileName").asText(""));
            if (oldAttachment.hasNonNull("scadenza")) record.put("scadenza", oldAttachment.path("scadenza").asText(""));
        }
        certifications.set(certificationKey, record);
        copy.set("certificazioni", certifications);
        return copy;
    }

    private static void syncLegacyCertificationFlag(ObjectNode payload, String certificationKey, boolean present) {
        if ("iso9001".equalsIgnoreCase(certificationKey)) {
            payload.put("iso9001", present ? "YES" : "NO");
        }
    }

    static boolean matches(JsonNode attachment, String documentType, String certificationKey) {
        if (attachment == null || !attachment.isObject()) return false;
        String attType = attachment.path("documentType").asText("");
        if (!attType.equals(documentType)) return false;
        if (certificationKey == null || certificationKey.isBlank()) {
            return !attachment.hasNonNull("certificationKey")
                    || attachment.path("certificationKey").asText("").isBlank();
        }
        return certificationKey.equals(attachment.path("certificationKey").asText(""));
    }
}
