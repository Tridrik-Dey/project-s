package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.supplierplatform.revamp.enums.RegistryType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RevampDraftPayloadUpConverter {

    private final ObjectMapper objectMapper;

    public JsonNode convertForDraftRead(RegistryType registryType, String sectionKey, JsonNode payload) {
        if (payload == null || payload.isNull() || !payload.isObject()) return payload;
        String key = sectionKey == null ? "" : sectionKey.trim().toUpperCase();
        ObjectNode node = ((ObjectNode) payload).deepCopy();

        switch (key) {
            case "S3A" -> convertS3A(node);
            case "S3B" -> convertS3B(node);
            case "S4" -> convertS4(registryType, node);
            case "S5" -> convertS5(node);
            default -> {
                return payload;
            }
        }
        return node;
    }

    private void convertS3A(ObjectNode node) {
        String thematicAreasCsv = text(node, "thematicAreasCsv");
        String yearsExperience = text(node, "yearsExperience");
        String presentation = text(node, "presentation");

        if (!node.has("education") || !node.path("education").isObject()) {
            ObjectNode education = objectMapper.createObjectNode();
            education.put("highestTitle", "");
            education.put("studyArea", "");
            education.put("graduationYear", "");
            node.set("education", education);
        }

        if (!node.has("competencies") || !node.path("competencies").isArray() || node.path("competencies").isEmpty()) {
            ArrayNode competencies = objectMapper.createArrayNode();
            ObjectNode item = objectMapper.createObjectNode();
            item.put("theme", thematicAreasCsv);
            item.put("details", presentation);
            item.put("yearsBand", yearsExperience);
            competencies.add(item);
            node.set("competencies", competencies);
        }
    }

    private void convertS3B(ObjectNode node) {
        if (!node.has("services") || !node.path("services").isArray() || node.path("services").isEmpty()) {
            ArrayNode services = objectMapper.createArrayNode();
            String specialization = text(node, "specialization");
            if (!specialization.isBlank()) {
                for (String token : specialization.split(",")) {
                    String value = token == null ? "" : token.trim();
                    if (!value.isBlank()) services.add(value);
                }
            }
            node.set("services", services);
        }

        if (!node.has("territory") || !node.path("territory").isObject()) {
            ObjectNode territory = objectMapper.createObjectNode();
            territory.put("regionsCsv", "");
            territory.put("provincesCsv", text(node, "operationalScope"));
            node.set("territory", territory);
        } else {
            ObjectNode territory = (ObjectNode) node.path("territory");
            if (text(territory, "regionsCsv").isBlank()) territory.put("regionsCsv", "");
            if (text(territory, "provincesCsv").isBlank()) territory.put("provincesCsv", text(node, "operationalScope"));
        }
    }

    private void convertS4(RegistryType registryType, ObjectNode node) {
        if (registryType != RegistryType.ALBO_A) return;
        if (node.has("references") && node.path("references").isArray() && !node.path("references").isEmpty()) return;

        String referencesSummary = text(node, "referencesSummary");
        ArrayNode references = objectMapper.createArrayNode();
        ObjectNode first = objectMapper.createObjectNode();
        first.put("fullName", referencesSummary);
        first.put("organizationRole", "");
        first.put("email", "");
        first.put("phone", "");
        references.add(first);
        node.set("references", references);
    }

    private void convertS5(ObjectNode node) {
        copyAlias(node, "truthfulnessDeclaration", "declarationTruthful");
        copyAlias(node, "noConflictOfInterest", "declarationNoConflict");
        copyAlias(node, "qualityEnvSafetyAccepted", "qualityStandardsAccepted");
        copyAlias(node, "alboDataProcessingConsent", "dataProcessingConsent");
        copyAlias(node, "noCriminalConvictions", "declarationTruthful");
    }

    private void copyAlias(ObjectNode node, String canonicalKey, String legacyKey) {
        if (node.has(canonicalKey)) return;
        if (node.has(legacyKey)) {
            node.set(canonicalKey, node.get(legacyKey));
        }
    }

    private String text(JsonNode node, String key) {
        if (node == null || node.isNull()) return "";
        JsonNode value = node.path(key);
        if (value.isMissingNode() || value.isNull()) return "";
        String text = value.asText("");
        return text == null ? "" : text.trim();
    }
}

