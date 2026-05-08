package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.supplierplatform.revamp.enums.RegistryType;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.function.Supplier;

@Component
public class RevampSectionPayloadValidator {

    private static final Set<String> SECTION_KEYS_ALBO_A = Set.of("S1", "S2", "S3A", "S3B", "S4", "S5");
    private static final Set<String> SECTION_KEYS_ALBO_B = Set.of("S1", "S2", "S3", "S4", "S5");
    private static final java.util.regex.Pattern ATECO_CODE_PATTERN =
            java.util.regex.Pattern.compile("^\\d{2}(?:\\.\\d{1,2})?(?:\\.\\d{1,2})?$");

    private static final Map<String, String> LEGACY_EMPLOYEE_RANGE_MAP = Map.of(
            "SOLO_TITOLARE", "E_1_9",
            "2_5", "E_1_9",
            "6_15", "E_10_49",
            "16_50", "E_10_49",
            "51_250", "E_50_249",
            "OVER_250", "E_250_PLUS"
    );

    private static final Set<String> PROFESSIONAL_TYPE_VALUES = Set.of(
            "DOCENTE_FORMATORE", "CONSULENTE", "PSICOLOGO_COACH", "ALTRO"
    );

    private static final Set<String> EMPLOYEE_RANGE_VALUES = Set.of(
            "E_1_9", "E_10_49", "E_50_249", "E_250_PLUS"
    );

    private static final Set<String> LEGAL_FORM_VALUES = Set.of(
            "SRL", "SPA", "SNC", "SAS", "COOPERATIVA", "ASSOCIAZIONE", "FONDAZIONE", "ETS", "ALTRO"
    );

    private static final Map<String, String> SERVICE_TO_CATEGORY = initServiceToCategory();

    public JsonNode validateAndNormalize(
            RegistryType registryType,
            String sectionKey,
            JsonNode payload,
            boolean completed,
            Supplier<Optional<JsonNode>> latestS3ASupplier
    ) {
        String normalizedSectionKey = normalizeSectionKey(sectionKey);
        validateSectionKeyAllowed(registryType, normalizedSectionKey);
        ObjectNode obj = requireObjectPayload(payload, normalizedSectionKey);

        if (registryType == RegistryType.ALBO_A) {
            validateAlboA(normalizedSectionKey, obj, completed, latestS3ASupplier);
        } else if (registryType == RegistryType.ALBO_B) {
            validateAlboB(normalizedSectionKey, obj, completed);
        } else {
            throw new IllegalArgumentException("Unsupported registry type for section validation: " + registryType);
        }
        return obj;
    }

    private void validateAlboA(String sectionKey, ObjectNode payload, boolean completed, Supplier<Optional<JsonNode>> latestS3ASupplier) {
        switch (sectionKey) {
            case "S1" -> {
                if (!completed) break;
                requireAnyNonBlank(payload, "firstName");
                requireAnyNonBlank(payload, "lastName");
                requireAnyNonBlank(payload, "birthDate");
                requireAnyNonBlank(payload, "birthPlace");
                requireAnyNonBlank(payload, "taxCode");
                requireAnyNonBlank(payload, "addressLine");
                requireAnyNonBlank(payload, "city");
                requireAnyNonBlank(payload, "postalCode");
                requireAnyNonBlank(payload, "province");
                requireAnyNonBlank(payload, "phone");
                requireAnyNonBlank(payload, "email");
            }
            case "S2" -> validateAlboAS2(payload, completed);
            case "S3A" -> {
                if (!completed) break;
                requireAnyNonBlank(payload, "thematicAreasCsv", "competencies");
                requireAnyNonBlank(payload, "yearsExperience", "presentation", "education");
                validateS3ACollections(payload);
            }
            case "S3B" -> {
                if (!completed) break;
                validateAlboAS3B(payload);
            }
            case "S4" -> validateAlboAS4(payload, completed);
            case "S5" -> validateAlboAS5(payload, completed, latestS3ASupplier);
            default -> throw new IllegalArgumentException("Unsupported section key for ALBO_A: " + sectionKey);
        }
    }

    private void validateAlboB(String sectionKey, ObjectNode payload, boolean completed) {
        switch (sectionKey) {
            case "S1" -> validateAlboBS1(payload, completed);
            case "S2" -> validateAlboBS2(payload, completed);
            case "S3" -> validateAlboBS3(payload, completed);
            case "S4" -> {
                validateAlboBS4(payload, completed);
            }
            case "S5" -> validateAlboBS5(payload, completed);
            default -> throw new IllegalArgumentException("Unsupported section key for ALBO_B: " + sectionKey);
        }
    }

    private void validateAlboAS2(ObjectNode payload, boolean completed) {
        String professionalTypeRaw = extractText(payload, "professionalType");
        if (completed && (professionalTypeRaw == null || professionalTypeRaw.isBlank())) {
            throw new IllegalArgumentException("S2 professionalType is required");
        }
        if (!isBlank(professionalTypeRaw)) {
            String professionalType = normalizeProfessionalType(professionalTypeRaw);
            payload.put("professionalType", professionalType);
            if (!PROFESSIONAL_TYPE_VALUES.contains(professionalType)) {
                throw new IllegalArgumentException("S2 professionalType is invalid: " + professionalTypeRaw);
            }
            if ("ALTRO".equals(professionalType) && completed && isBlank(extractText(payload, "atecoCode"))) {
                throw new IllegalArgumentException("S2 atecoCode is required when professionalType is ALTRO");
            }
            validateAtecoField(payload, "atecoCode", false);
        }

        JsonNode secondary = payload.path("secondaryProfessionalTypes");
        if (secondary.isArray()) {
            ArrayNode arr = (ArrayNode) secondary;
            for (JsonNode value : arr) {
                String item = normalizeProfessionalType(value.asText(""));
                if (item.isBlank()) continue;
                if (!PROFESSIONAL_TYPE_VALUES.contains(item)) {
                    throw new IllegalArgumentException("S2 secondaryProfessionalTypes contains invalid value: " + value.asText());
                }
            }
        }
    }

    private void validateAlboAS5(ObjectNode payload, boolean completed, Supplier<Optional<JsonNode>> latestS3ASupplier) {
        normalizeBooleanAlias(payload, "qualityStandardsAccepted", "qualityEnvSafetyAccepted");
        normalizeBooleanAlias(payload, "declarationTruthful", "truthfulnessDeclaration");
        normalizeBooleanAlias(payload, "declarationNoConflict", "noConflictOfInterest");
        normalizeBooleanAlias(payload, "declarationNoCriminalConvictions", "noCriminalConvictions");
        normalizeBooleanAlias(payload, "dataProcessingConsent", "alboDataProcessingConsent");

        if (!completed) return;
        requireBooleanTrue(payload, "truthfulnessDeclaration");
        requireBooleanTrue(payload, "noConflictOfInterest");
        requireBooleanTrue(payload, "noCriminalConvictions");
        requireBooleanTrue(payload, "privacyAccepted");
        requireBooleanTrue(payload, "ethicalCodeAccepted");
        requireBooleanTrue(payload, "qualityEnvSafetyAccepted");
        requireBooleanTrue(payload, "alboDataProcessingConsent");
        requireBoolean(payload, "marketingConsent");

        boolean inPresenceTeaching = detectInPresenceTeaching(payload, latestS3ASupplier);
        if (inPresenceTeaching && !extractBoolean(payload, "dlgs81ComplianceWhenInPresence")) {
            throw new IllegalArgumentException("S5 dlgs81ComplianceWhenInPresence is required for in-presence teaching");
        }
    }

    private void validateAlboAS4(ObjectNode payload, boolean completed) {
        if (!completed) return;
        requireAnyNonBlank(payload, "operationalCapacity");
        JsonNode refsNode = payload.path("references");
        if (refsNode.isArray() && refsNode.size() > 2) {
            throw new IllegalArgumentException("S4 references exceed max limit (2)");
        }
        Set<String> types = extractAndValidateAttachmentTypes(payload);
        if (!types.contains("CV")) {
            throw new IllegalArgumentException("S4 requires CV attachment metadata");
        }
    }

    private void validateAlboBS4(ObjectNode payload, boolean completed) {
        if (!completed) return;
        requireAnyNonBlank(payload, "iso9001");
        boolean hasLegacyAccreditation =
                !isBlank(extractText(payload, "accreditationSummary"))
                        || (payload.path("accreditations").isArray() && payload.path("accreditations").size() > 0);
        if (!hasLegacyAccreditation) {
            requireAnyNonBlank(payload, "accreditamentoFormazione", "accreditationTraining");
            requireAnyNonBlank(payload, "accreditamentoServiziLavoro", "employmentServicesAccreditation");
        }

        Set<String> types = extractAndValidateAttachmentTypes(payload);
        if (!types.contains("VISURA_CAMERALE")) {
            throw new IllegalArgumentException("S4 requires VISURA_CAMERALE attachment metadata");
        }
        if (!types.contains("DURC")) {
            throw new IllegalArgumentException("S4 requires DURC attachment metadata");
        }
        boolean certificationsDeclared =
                "YES".equalsIgnoreCase(extractText(payload, "iso9001"))
                        || !isBlank(extractText(payload, "accreditationSummary"))
                        || isAffirmative(extractText(payload, "accreditamentoFormazione"))
                        || isAffirmative(extractText(payload, "accreditamentoServiziLavoro"))
                        || isAffirmative(extractText(payload, "accreditationTraining"))
                        || isAffirmative(extractText(payload, "employmentServicesAccreditation"))
                        || (payload.path("accreditations").isArray() && payload.path("accreditations").size() > 0);
        if (certificationsDeclared && !types.contains("CERTIFICATION")) {
            throw new IllegalArgumentException("S4 requires CERTIFICATION attachment metadata when accreditations are declared");
        }
    }

    private Set<String> extractAndValidateAttachmentTypes(ObjectNode payload) {
        Set<String> types = new HashSet<>();
        JsonNode attachments = payload.path("attachments");
        if (!attachments.isArray()) {
            return types;
        }
        for (JsonNode item : attachments) {
            String type = item.path("documentType").asText("").trim().toUpperCase(Locale.ROOT);
            if (type.isBlank()) continue;
            String fileName = item.path("fileName").asText("").trim();
            String storageKey = item.path("storageKey").asText("").trim();
            if (fileName.isBlank() || storageKey.isBlank()) {
                throw new IllegalArgumentException("S4 attachment metadata requires fileName and storageKey");
            }
            if ("upload-pending".equalsIgnoreCase(storageKey)) {
                throw new IllegalArgumentException("S4 attachment metadata requires an uploaded storageKey");
            }
            types.add(type);
        }
        return types;
    }

    private void validateAlboAS3B(ObjectNode payload) {
        requireAnyNonBlank(payload, "highestTitle");
        requireAnyNonBlank(payload, "studyArea");
        requireAnyNonBlank(payload, "experienceBand");
        requireAnyNonBlank(payload, "services");
        requireAnyNonBlank(payload, "hourlyRateRange");

        JsonNode territory = payload.path("territory");
        boolean hasTerritory = territory.isObject() && (
                !territory.path("regionsCsv").asText("").isBlank()
                        || !territory.path("provincesCsv").asText("").isBlank()
        );
        if (!hasTerritory) {
            throw new IllegalArgumentException("S3B territory is required");
        }
    }

    private boolean detectInPresenceTeaching(ObjectNode s5Payload, Supplier<Optional<JsonNode>> latestS3ASupplier) {
        if (extractBoolean(s5Payload, "teachingInPresence") || extractBoolean(s5Payload, "inPresenceTeaching")) {
            return true;
        }
        Optional<JsonNode> maybeS3A = latestS3ASupplier.get();
        if (maybeS3A.isEmpty() || !maybeS3A.get().isObject()) return false;
        JsonNode s3a = maybeS3A.get();
        if (s3a.path("availability").path("inPresence").asBoolean(false)) return true;
        JsonNode experiences = s3a.path("experiences");
        if (experiences.isArray()) {
            for (JsonNode exp : experiences) {
                String mode = exp.path("deliveryMode").asText("");
                if ("IN_PRESENCE".equalsIgnoreCase(mode) || "AULA".equalsIgnoreCase(mode) || "BLENDED".equalsIgnoreCase(mode)) {
                    return true;
                }
            }
        }
        return false;
    }

    private void validateAlboBS1(ObjectNode payload, boolean completed) {
        if (!completed) return;
        requireAnyNonBlank(payload, "companyName");
        requireAnyNonBlank(payload, "vatNumber");
        requireAnyNonBlank(payload, "reaNumber");
        requireAnyNonBlank(payload, "cciaaProvince");
        requireAnyNonBlank(payload, "incorporationDate");
        requireAnyNonBlank(payload, "legalForm");
        requireAnyNonBlank(payload, "institutionalEmail");
        requireAnyNonBlank(payload, "phone");

        String legalRepName = firstNonBlank(
                extractText(payload, "legalRepresentativeName"),
                payload.path("legalRepresentative").path("name").asText(null)
        );
        if (isBlank(legalRepName)) {
            throw new IllegalArgumentException("S1 legal representative name is required");
        }
        String legalRepTaxCode = payload.path("legalRepresentative").path("taxCode").asText(null);
        if (isBlank(legalRepTaxCode)) {
            throw new IllegalArgumentException("S1 legal representative taxCode is required");
        }
        String legalRepRole = payload.path("legalRepresentative").path("role").asText(null);
        if (isBlank(legalRepRole)) {
            throw new IllegalArgumentException("S1 legal representative role is required");
        }
        String legalRepIdExpiry = payload.path("legalRepresentative").path("idDocumentExpiry").asText(null);
        if (isBlank(legalRepIdExpiry)) {
            throw new IllegalArgumentException("S1 legal representative idDocumentExpiry is required");
        }
        JsonNode legalRepIdDoc = payload.path("legalRepresentative").path("idDocumentAttachment");
        if (legalRepIdDoc.isMissingNode() || legalRepIdDoc.isNull() || isBlank(legalRepIdDoc.path("storageKey").asText(null))) {
            throw new IllegalArgumentException("S1 legal representative idDocumentAttachment is required");
        }

        String opContactName = payload.path("operationalContact").path("name").asText(null);
        if (isBlank(opContactName)) {
            throw new IllegalArgumentException("S1 operational contact name is required");
        }
        String opContactEmail = firstNonBlank(
                extractText(payload, "operationalContactEmail"),
                payload.path("operationalContact").path("email").asText(null)
        );
        if (isBlank(opContactEmail)) {
            throw new IllegalArgumentException("S1 operational contact email is required");
        }
        String opContactPhone = payload.path("operationalContact").path("phone").asText(null);
        if (isBlank(opContactPhone)) {
            throw new IllegalArgumentException("S1 operational contact phone is required");
        }

        String legalStreet = payload.path("legalAddress").path("street").asText(null);
        String legalCity = payload.path("legalAddress").path("city").asText(null);
        String legalCap = payload.path("legalAddress").path("cap").asText(null);
        String legalProvince = payload.path("legalAddress").path("province").asText(null);
        if (isBlank(legalStreet) || isBlank(legalCity) || isBlank(legalCap) || isBlank(legalProvince)) {
            throw new IllegalArgumentException("S1 legalAddress fields are required");
        }

        String legalForm = extractText(payload, "legalForm");
        if (!isBlank(legalForm)) {
            String normalized = legalForm.trim().toUpperCase(Locale.ROOT);
            if (!LEGAL_FORM_VALUES.contains(normalized)) {
                throw new IllegalArgumentException("S1 legalForm is invalid: " + legalForm);
            }
            payload.put("legalForm", normalized);
        }
    }

    private void validateAlboBS2(ObjectNode payload, boolean completed) {
        String rawEmployeeRange = extractText(payload, "employeeRange");
        if (completed && isBlank(rawEmployeeRange)) {
            throw new IllegalArgumentException("S2 employeeRange is required");
        }
        if (!isBlank(rawEmployeeRange)) {
            String normalizedEmployeeRange = LEGACY_EMPLOYEE_RANGE_MAP.getOrDefault(rawEmployeeRange, rawEmployeeRange);
            payload.put("employeeRange", normalizedEmployeeRange);
            if (!EMPLOYEE_RANGE_VALUES.contains(normalizedEmployeeRange)) {
                throw new IllegalArgumentException("S2 employeeRange is invalid: " + rawEmployeeRange);
            }
        }

        if (completed) {
            requireAnyNonBlank(payload, "atecoPrimary");
            validateAtecoField(payload, "atecoPrimary", true);
            requireAnyNonBlank(payload, "revenueBand");
            validateOperatingRegions(payload);
            validateAtecoSecondary(payload);
        }

        String thirdSectorType = extractText(payload, "thirdSectorType");
        if (!isBlank(thirdSectorType)) {
            String runtsNumber = extractText(payload, "runtsNumber");
            if (isBlank(runtsNumber)) {
                throw new IllegalArgumentException("S2 runtsNumber is required when thirdSectorType is set");
            }
        }
    }

    private void validateOperatingRegions(ObjectNode payload) {
        JsonNode regionsNode = payload.path("operatingRegions");
        if (regionsNode.isArray()) {
            int valid = 0;
            for (JsonNode item : regionsNode) {
                if (!item.path("region").asText("").isBlank()) {
                    valid++;
                }
            }
            if (valid <= 0) {
                throw new IllegalArgumentException("S2 operatingRegions requires at least one region");
            }
            return;
        }
        requireAnyNonBlank(payload, "operatingRegions");
    }

    private void validateAtecoSecondary(ObjectNode payload) {
        JsonNode secondary = payload.path("atecoSecondary");
        if (!secondary.isArray() && payload.path("atecoSecondari").isArray()) {
            secondary = payload.path("atecoSecondari");
        }
        if (secondary.isArray() && secondary.size() > 3) {
            throw new IllegalArgumentException("S2 atecoSecondary exceeds max limit (3)");
        }
        if (secondary.isArray()) {
            for (JsonNode value : secondary) {
                validateAtecoValue(value.asText(""), "S2 atecoSecondary is invalid");
            }
        }
    }

    private void validateAlboBS3(ObjectNode payload, boolean completed) {
        if (!completed) return;
        Map<String, Integer> selectedByCategory = countSelectedByCategory(payload);
        int totalSelected = selectedByCategory.values().stream().mapToInt(Integer::intValue).sum();
        if (totalSelected <= 0) {
            throw new IllegalArgumentException("S3 requires at least one selected service");
        }

        JsonNode descriptionsNode = payload.path("descriptionsByCategory");
        for (Map.Entry<String, Integer> entry : selectedByCategory.entrySet()) {
            if (entry.getValue() <= 0) continue;
            String category = entry.getKey();
            String description = descriptionsNode.isObject() ? descriptionsNode.path(category).asText("") : "";
            if (description.isBlank()) {
                throw new IllegalArgumentException("S3 description is required for category " + category + " when services are selected");
            }
            if (description.trim().length() > 400) {
                throw new IllegalArgumentException("S3 description exceeds max length (400) for category " + category);
            }
        }
    }

    private void validateAlboBS5(ObjectNode payload, boolean completed) {
        normalizeBooleanAlias(payload, "qualityStandardsAccepted", "qualityEnvSafetyAccepted");
        normalizeBooleanAlias(payload, "declarationTruthful", "truthfulnessDeclaration");
        normalizeBooleanAlias(payload, "declarationNoConflict", "noConflictOfInterest");
        normalizeBooleanAlias(payload, "declarationNoCriminalConvictions", "noCriminalConvictions");
        normalizeBooleanAlias(payload, "dataProcessingConsent", "alboDataProcessingConsent");

        if (!completed) return;
        requireBooleanTrue(payload, "truthfulnessDeclaration");
        requireBooleanTrue(payload, "noConflictOfInterest");
        requireBooleanTrue(payload, "noCriminalConvictions");
        requireBooleanTrue(payload, "privacyAccepted");
        requireBooleanTrue(payload, "ethicalCodeAccepted");
        requireBooleanTrue(payload, "qualityEnvSafetyAccepted");
        requireBooleanTrue(payload, "alboDataProcessingConsent");
        requireBoolean(payload, "marketingConsent");
        requireBooleanTrue(payload, "antimafiaDeclaration");
        requireBooleanTrue(payload, "dlgs231Declaration");
        requireBoolean(payload, "model231Adopted");
        requireBooleanTrue(payload, "fiscalContributionRegularity");
        requireBooleanTrue(payload, "gdprComplianceAndDpo");
    }

    private void validateS3ACollections(ObjectNode payload) {
        JsonNode competenciesNode = payload.path("competencies");
        if (competenciesNode.isArray()) {
            int validCount = 0;
            for (JsonNode item : competenciesNode) {
                String theme = item.path("theme").asText("");
                String details = item.path("details").asText("");
                String yearsBand = item.path("yearsBand").asText("");
                if (!theme.isBlank() && !details.isBlank() && !yearsBand.isBlank()) {
                    validCount++;
                }
            }
            if (validCount == 0 && isBlank(extractText(payload, "thematicAreasCsv"))) {
                throw new IllegalArgumentException("S3A requires at least one complete competency");
            }
        }

        JsonNode experiencesNode = payload.path("experiences");
        if (experiencesNode.isArray() && experiencesNode.size() > 5) {
            throw new IllegalArgumentException("S3A experiences exceed max limit (5)");
        }
    }

    private static Map<String, String> initServiceToCategory() {
        Map<String, String> map = new HashMap<>();
        putAll(map, "CAT_A", "TRAINING_DESIGN", "AULA_TRAINING", "ONLINE_SYNC", "ELEARNING_CONTENT", "LMS_CONTENT",
                "LMS_PLATFORM", "FUNDED_COURSES", "ACTIVE_POLICIES", "ASSESSMENT", "SIMULATION", "TRANSLATION_LOCALIZATION");
        putAll(map, "CAT_B", "RECRUITING", "STAFFING", "OUTPLACEMENT", "PAYROLL", "WELFARE", "HR_CONSULTING",
                "ORG_DEVELOPMENT", "COACHING");
        putAll(map, "CAT_C", "CUSTOM_SOFTWARE", "HRIS", "DIGITAL_MARKETING", "CYBERSECURITY", "UX_UI",
                "BI_DASHBOARD", "CLOUD_MANAGED_HELPDESK", "AI_AUTOMATION");
        putAll(map, "CAT_D", "LABOR_CONSULTING", "TAX_ACCOUNTING", "LEGAL", "FUNDING", "STRATEGY",
                "AUDIT_QUALITY", "GDPR_231_ESG", "THIRD_SECTOR_SERVICES", "IMPACT_EVALUATION");
        putAll(map, "CAT_E", "TRAINING_MATERIALS", "COMMUNICATION", "EVENTS", "LOGISTICS", "FACILITY",
                "CATERING_HOSPITALITY", "AV_RENTAL", "BACKOFFICE", "TRANSLATION_INTERPRETING");
        return Collections.unmodifiableMap(map);
    }

    private static void putAll(Map<String, String> map, String category, String... services) {
        for (String service : services) {
            map.put(service, category);
        }
    }

    private Map<String, Integer> countSelectedByCategory(ObjectNode payload) {
        Map<String, Integer> selected = new HashMap<>();
        JsonNode byCategory = payload.path("servicesByCategory");
        if (byCategory.isObject()) {
            Iterator<String> fields = byCategory.fieldNames();
            while (fields.hasNext()) {
                String category = fields.next();
                JsonNode arr = byCategory.path(category);
                if (arr.isArray()) {
                    selected.put(category, arr.size());
                }
            }
            return selected;
        }

        String csv = extractText(payload, "serviceCategoriesCsv");
        if (isBlank(csv)) return selected;

        for (String token : csv.split(",")) {
            String serviceId = token == null ? "" : token.trim();
            if (serviceId.isBlank()) continue;
            String category = SERVICE_TO_CATEGORY.get(serviceId);
            if (category == null) continue;
            selected.put(category, selected.getOrDefault(category, 0) + 1);
        }
        return selected;
    }

    private void validateSectionKeyAllowed(RegistryType registryType, String sectionKey) {
        Set<String> allowed = registryType == RegistryType.ALBO_A ? SECTION_KEYS_ALBO_A : SECTION_KEYS_ALBO_B;
        if (!allowed.contains(sectionKey)) {
            throw new IllegalArgumentException("Section " + sectionKey + " is not valid for " + registryType);
        }
    }

    private String normalizeSectionKey(String sectionKey) {
        if (sectionKey == null || sectionKey.isBlank()) {
            throw new IllegalArgumentException("sectionKey is required");
        }
        return sectionKey.trim().toUpperCase(Locale.ROOT);
    }

    private ObjectNode requireObjectPayload(JsonNode payload, String sectionKey) {
        if (payload == null || payload.isNull()) {
            throw new IllegalArgumentException("Section " + sectionKey + " payload is required");
        }
        if (!payload.isObject()) {
            throw new IllegalArgumentException("Section " + sectionKey + " payload must be a JSON object");
        }
        return ((ObjectNode) payload).deepCopy();
    }

    private void requireAnyNonBlank(ObjectNode payload, String... keys) {
        for (String key : keys) {
            if ("competencies".equals(key)) {
                JsonNode node = payload.path("competencies");
                if (node.isArray() && node.size() > 0) return;
            } else if ("references".equals(key)) {
                JsonNode node = payload.path("references");
                if (node.isArray() && node.size() > 0) return;
            } else if ("services".equals(key)) {
                JsonNode node = payload.path("services");
                if (node.isArray() && node.size() > 0) return;
            } else if ("territory".equals(key)) {
                JsonNode node = payload.path("territory");
                if (node.isObject()) return;
            } else if ("education".equals(key)) {
                JsonNode node = payload.path("education");
                if (node.isObject()) return;
            } else if ("accreditations".equals(key)) {
                JsonNode node = payload.path("accreditations");
                if (node.isArray() && node.size() > 0) return;
            } else if (!isBlank(extractText(payload, key))) {
                return;
            }
        }
        throw new IllegalArgumentException("Missing required field(s): " + String.join(", ", keys));
    }

    private void requireBooleanTrue(ObjectNode payload, String key) {
        JsonNode node = payload.get(key);
        if (node == null || !node.isBoolean() || !node.asBoolean()) {
            throw new IllegalArgumentException("Field " + key + " must be true");
        }
    }

    private void requireBoolean(ObjectNode payload, String key) {
        JsonNode node = payload.get(key);
        if (node == null || !node.isBoolean()) {
            throw new IllegalArgumentException("Field " + key + " must be a boolean");
        }
    }

    private void normalizeBooleanAlias(ObjectNode payload, String legacyKey, String canonicalKey) {
        JsonNode legacy = payload.get(legacyKey);
        JsonNode canonical = payload.get(canonicalKey);
        if (legacy != null && canonical == null) {
            payload.set(canonicalKey, legacy);
        } else if (canonical != null && legacy == null) {
            payload.set(legacyKey, canonical);
        }
    }

    private String normalizeProfessionalType(String raw) {
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        if ("COACH".equals(normalized) || "MENTOR".equals(normalized)) {
            return "PSICOLOGO_COACH";
        }
        return normalized;
    }

    private void validateAtecoField(ObjectNode payload, String key, boolean required) {
        String value = extractText(payload, key);
        if (isBlank(value)) {
            if (required) {
                throw new IllegalArgumentException("S2 " + key + " is required");
            }
            return;
        }
        String normalized = normalizeAtecoCode(value);
        validateAtecoValue(normalized, "S2 " + key + " is invalid");
        payload.put(key, normalized);
    }

    private void validateAtecoValue(String value, String message) {
        if (isBlank(value)) return;
        String normalized = normalizeAtecoCode(value);
        if (!ATECO_CODE_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException(message);
        }
    }

    private String normalizeAtecoCode(String value) {
        return value == null ? "" : value.trim().replace(',', '.');
    }

    private boolean extractBoolean(ObjectNode payload, String key) {
        JsonNode node = payload.get(key);
        return node != null && node.isBoolean() && node.asBoolean(false);
    }

    private String extractText(ObjectNode payload, String key) {
        JsonNode node = payload.get(key);
        if (node == null || node.isNull()) return null;
        if (node.isTextual()) return node.asText();
        if (node.isNumber() || node.isBoolean()) return node.asText();
        if (node.isArray()) {
            ArrayNode arr = (ArrayNode) node;
            return arr.size() > 0 ? arr.toString() : "";
        }
        if (node.isObject()) return node.toString();
        return node.asText(null);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (!isBlank(value)) return value;
        }
        return null;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private boolean isAffirmative(String value) {
        if (value == null) return false;
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        return "SI".equals(normalized) || "SÌ".equals(normalized) || "YES".equals(normalized) || "TRUE".equals(normalized);
    }
}
