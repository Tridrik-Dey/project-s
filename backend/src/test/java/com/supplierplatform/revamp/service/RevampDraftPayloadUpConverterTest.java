package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.revamp.enums.RegistryType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RevampDraftPayloadUpConverterTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RevampDraftPayloadUpConverter converter = new RevampDraftPayloadUpConverter(objectMapper);

    @Test
    void convertsS3ALegacyFieldsIntoCompetencies() throws Exception {
        var payload = objectMapper.readTree("""
                {
                  "thematicAreasCsv":"Digital Learning, HR",
                  "yearsExperience":"10-15 anni",
                  "presentation":"Esperienza su LMS"
                }
                """);

        var converted = converter.convertForDraftRead(RegistryType.ALBO_A, "S3A", payload);
        assertTrue(converted.path("education").isObject());
        assertEquals("Digital Learning, HR", converted.path("competencies").get(0).path("theme").asText());
        assertEquals("Esperienza su LMS", converted.path("competencies").get(0).path("details").asText());
        assertEquals("10-15 anni", converted.path("competencies").get(0).path("yearsBand").asText());
    }

    @Test
    void convertsS3BLegacyFieldsIntoServicesAndTerritory() throws Exception {
        var payload = objectMapper.readTree("""
                {
                  "specialization":"Audit e due diligence, Consulenza organizzativa",
                  "operationalScope":"MI,MB"
                }
                """);

        var converted = converter.convertForDraftRead(RegistryType.ALBO_A, "S3B", payload);
        assertEquals("Audit e due diligence", converted.path("services").get(0).asText());
        assertEquals("Consulenza organizzativa", converted.path("services").get(1).asText());
        assertEquals("MI,MB", converted.path("territory").path("provincesCsv").asText());
    }

    @Test
    void convertsS4LegacyReferencesSummaryForAlboA() throws Exception {
        var payload = objectMapper.readTree("""
                {
                  "referencesSummary":"Mario Rossi - CFO"
                }
                """);

        var converted = converter.convertForDraftRead(RegistryType.ALBO_A, "S4", payload);
        assertEquals("Mario Rossi - CFO", converted.path("references").get(0).path("fullName").asText());
    }

    @Test
    void convertsS5LegacyAliasesToCanonicalKeys() throws Exception {
        var payload = objectMapper.readTree("""
                {
                  "declarationTruthful": true,
                  "declarationNoConflict": true,
                  "qualityStandardsAccepted": true,
                  "dataProcessingConsent": true
                }
                """);

        var converted = converter.convertForDraftRead(RegistryType.ALBO_B, "S5", payload);
        assertTrue(converted.path("truthfulnessDeclaration").asBoolean(false));
        assertTrue(converted.path("noConflictOfInterest").asBoolean(false));
        assertTrue(converted.path("qualityEnvSafetyAccepted").asBoolean(false));
        assertTrue(converted.path("alboDataProcessingConsent").asBoolean(false));
        assertTrue(converted.path("noCriminalConvictions").asBoolean(false));
    }
}

