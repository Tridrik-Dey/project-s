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
