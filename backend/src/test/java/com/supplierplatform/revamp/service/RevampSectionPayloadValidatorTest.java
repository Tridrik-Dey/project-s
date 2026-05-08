package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.supplierplatform.revamp.enums.RegistryType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RevampSectionPayloadValidatorTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private RevampSectionPayloadValidator validator;

    @BeforeEach
    void setUp() {
        validator = new RevampSectionPayloadValidator();
    }

    @Test
    void alboASection2RequiresAtecoWhenProfessionalTypeIsAltro() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {"professionalType":"ALTRO","atecoCode":""}
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_A, "S2", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("atecoCode"));
    }

    @Test
    void alboBSection2NormalizesLegacyEmployeeRange() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {"employeeRange":"16_50","atecoPrimary":"85.59","revenueBand":"R_100_500K","operatingRegions":"Lombardia"}
            """);

        JsonNode normalized = validator.validateAndNormalize(RegistryType.ALBO_B, "S2", payload, true, Optional::empty);
        assertEquals("E_10_49", normalized.path("employeeRange").asText());
    }

    @Test
    void alboBSection2RejectsMoreThanThreeSecondaryAteco() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "employeeRange":"E_10_49",
              "revenueBand":"R_100_500K",
              "atecoPrimary":"85.59",
              "operatingRegions":[{"region":"Lombardia","provincesCsv":"MI"}],
              "atecoSecondary":["70.22","62.01","74.90","82.99"]
            }
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_B, "S2", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("max limit"));
    }

    @Test
    void alboBSection2RequiresRuntsWhenThirdSectorProvided() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "employeeRange":"E_10_49",
              "revenueBand":"R_100_500K",
              "atecoPrimary":"85.59",
              "operatingRegions":[{"region":"Lombardia","provincesCsv":"MI"}],
              "thirdSectorType":"IMPRESA_SOCIALE",
              "runtsNumber":""
            }
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_B, "S2", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("runtsNumber"));
    }

    @Test
    void alboBSection3RequiresDescriptionPerSelectedCategory() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "servicesByCategory": {
                "CAT_A": ["TRAINING_DESIGN"]
              },
              "descriptionsByCategory": {
                "CAT_A": ""
              }
            }
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_B, "S3", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("description"));
    }

    @Test
    void alboBSection3RejectsDescriptionLongerThan400() throws Exception {
        String longDescription = "X".repeat(401);
        JsonNode payload = objectMapper.readTree("""
            {
              "servicesByCategory": {
                "CAT_A": ["TRAINING_DESIGN"]
              },
              "descriptionsByCategory": {
                "CAT_A": "%s"
              }
            }
            """.formatted(longDescription));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_B, "S3", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("max length"));
    }

    @Test
    void alboASection5RequiresDlgs81WhenInPresenceDetectedFromS3A() throws Exception {
        JsonNode s5Payload = objectMapper.readTree("""
            {
              "truthfulnessDeclaration": true,
              "noConflictOfInterest": true,
              "noCriminalConvictions": true,
              "privacyAccepted": true,
              "ethicalCodeAccepted": true,
              "qualityEnvSafetyAccepted": true,
              "alboDataProcessingConsent": true,
              "marketingConsent": false,
              "dlgs81ComplianceWhenInPresence": false
            }
            """);

        JsonNode s3a = objectMapper.readTree("""
            {
              "experiences": [
                {"deliveryMode":"IN_PRESENCE"}
              ]
            }
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_A, "S5", s5Payload, true, () -> Optional.of(s3a))
        );
        assertTrue(ex.getMessage().contains("dlgs81ComplianceWhenInPresence"));
    }

    @Test
    void alboBSection5RequiresGovernanceDeclarationsWhenCompleted() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "truthfulnessDeclaration": true,
              "noConflictOfInterest": true,
              "noCriminalConvictions": true,
              "privacyAccepted": true,
              "ethicalCodeAccepted": true,
              "qualityEnvSafetyAccepted": true,
              "alboDataProcessingConsent": true,
              "marketingConsent": false,
              "antimafiaDeclaration": true,
              "dlgs231Declaration": true,
              "model231Adopted": true,
              "fiscalContributionRegularity": true,
              "gdprComplianceAndDpo": false
            }
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_B, "S5", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("gdprComplianceAndDpo"));
    }

    @Test
    void alboBSection5AcceptsCanonicalDeclarations() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "truthfulnessDeclaration": true,
              "noConflictOfInterest": true,
              "noCriminalConvictions": true,
              "privacyAccepted": true,
              "ethicalCodeAccepted": true,
              "qualityEnvSafetyAccepted": true,
              "alboDataProcessingConsent": true,
              "marketingConsent": false,
              "antimafiaDeclaration": true,
              "dlgs231Declaration": true,
              "model231Adopted": false,
              "fiscalContributionRegularity": true,
              "gdprComplianceAndDpo": true
            }
            """);

        JsonNode normalized = validator.validateAndNormalize(RegistryType.ALBO_B, "S5", payload, true, Optional::empty);
        assertEquals(false, normalized.path("model231Adopted").asBoolean());
    }

    @Test
    void alboASection2NormalizesCoachToPsicologoCoach() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {"professionalType":"COACH","atecoCode":""}
            """);

        JsonNode normalized = validator.validateAndNormalize(RegistryType.ALBO_A, "S2", payload, true, Optional::empty);
        assertEquals("PSICOLOGO_COACH", normalized.path("professionalType").asText());
    }

    @Test
    void incompleteSectionAllowsPartialPayload() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {"companyName":"ACME"}
            """);

        JsonNode normalized = validator.validateAndNormalize(RegistryType.ALBO_B, "S1", payload, false, Optional::empty);
        assertEquals("ACME", normalized.path("companyName").asText());
    }

    @Test
    void alboBS1AcceptsStructuredPayloadWhenCompleted() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "companyName":"ACME",
              "legalForm":"srl",
              "vatNumber":"IT12345678901",
              "taxCodeIfDifferent":"",
              "reaNumber":"MI-123456",
              "cciaaProvince":"MI",
              "incorporationDate":"2019-01",
              "legalAddress":{"street":"Via Roma 1","city":"Milano","cap":"20100","province":"MI"},
              "operationalHeadquarter":{"street":"Via Torino 2","city":"Milano","cap":"20100","province":"MI"},
              "institutionalEmail":"info@acme.it",
              "pec":"acme@pec.it",
              "phone":"+3902123456",
              "website":"https://acme.it",
              "legalRepresentative":{"name":"Mario Rossi","taxCode":"RSSMRA80A01F205X","role":"Amministratore"},
              "operationalContact":{"name":"Laura Bianchi","role":"PM","email":"laura@acme.it","phone":"+3902123000"}
            }
            """);

        JsonNode normalized = validator.validateAndNormalize(RegistryType.ALBO_B, "S1", payload, true, Optional::empty);
        assertEquals("SRL", normalized.path("legalForm").asText());
    }

    @Test
    void alboBS1RejectsMissingLegalAddressWhenCompleted() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "companyName":"ACME",
              "legalForm":"SRL",
              "vatNumber":"IT12345678901",
              "reaNumber":"MI-123456",
              "cciaaProvince":"MI",
              "incorporationDate":"2019-01",
              "legalAddress":{"street":"","city":"Milano","cap":"20100","province":"MI"},
              "institutionalEmail":"info@acme.it",
              "phone":"+3902123456",
              "legalRepresentative":{"name":"Mario Rossi","taxCode":"RSSMRA80A01F205X","role":"Amministratore"},
              "operationalContact":{"name":"Laura Bianchi","email":"laura@acme.it","phone":"+3902123000"}
            }
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_B, "S1", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("legalAddress"));
    }

    @Test
    void alboAS3ARejectsMoreThanFiveExperiences() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "education": {"highestTitle":"Laurea","studyArea":"HR","graduationYear":"2018"},
              "competencies": [{"theme":"HR","details":"Recruiting","yearsBand":"Y5_10"}],
              "experiences": [
                {"clientName":"A","interventionType":"Docenza","mainTheme":"HR"},
                {"clientName":"B","interventionType":"Docenza","mainTheme":"HR"},
                {"clientName":"C","interventionType":"Docenza","mainTheme":"HR"},
                {"clientName":"D","interventionType":"Docenza","mainTheme":"HR"},
                {"clientName":"E","interventionType":"Docenza","mainTheme":"HR"},
                {"clientName":"F","interventionType":"Docenza","mainTheme":"HR"}
              ]
            }
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_A, "S3A", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("max limit"));
    }

    @Test
    void alboAS4AllowsMissingReferencesWhenOperationalCapacityProvided() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "operationalCapacity":"Gestione aule e piattaforme LMS",
              "references":[],
              "attachments":[{"documentType":"CV","fileName":"cv.pdf","storageKey":"s3://cv.pdf"}]
            }
            """);

        JsonNode normalized = validator.validateAndNormalize(RegistryType.ALBO_A, "S4", payload, true, Optional::empty);
        assertEquals("Gestione aule e piattaforme LMS", normalized.path("operationalCapacity").asText());
    }

    @Test
    void alboAS4RejectsMoreThanTwoReferences() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "operationalCapacity":"Capacita",
              "attachments":[{"documentType":"CV","fileName":"cv.pdf","storageKey":"s3://cv.pdf"}],
              "references":[
                {"fullName":"A","organizationRole":"R","email":"a@test.it","phone":"1"},
                {"fullName":"B","organizationRole":"R","email":"b@test.it","phone":"2"},
                {"fullName":"C","organizationRole":"R","email":"c@test.it","phone":"3"}
              ]
            }
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_A, "S4", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("max limit"));
    }

    @Test
    void alboAS4RejectsMissingCvAttachment() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "operationalCapacity":"Capacita",
              "references":[]
            }
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_A, "S4", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("CV"));
    }

    @Test
    void alboAS3BRequiresStructuredFieldsWhenCompleted() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "professionalOrder":"Ordine Consulenti",
              "highestTitle":"Laurea magistrale",
              "studyArea":"Psicologia del lavoro",
              "experienceBand":"Y8_15",
              "services":["Consulenza organizzativa","Mentoring specialistico"],
              "territory":{"regionsCsv":"Lombardia,Piemonte","provincesCsv":"MI,TO"},
              "hourlyRateRange":"80-120 EUR"
            }
            """);

        JsonNode normalized = validator.validateAndNormalize(RegistryType.ALBO_A, "S3B", payload, true, Optional::empty);
        assertEquals("Ordine Consulenti", normalized.path("professionalOrder").asText());
    }

    @Test
    void alboAS3BRejectsMissingTerritory() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "professionalOrder":"Ordine Consulenti",
              "highestTitle":"Laurea magistrale",
              "studyArea":"Psicologia del lavoro",
              "experienceBand":"Y8_15",
              "services":["Consulenza organizzativa"],
              "territory":{"regionsCsv":"","provincesCsv":""},
              "hourlyRateRange":"80-120 EUR"
            }
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_A, "S3B", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("territory"));
    }

    @Test
    void alboBS4RequiresVisuraDurcAndCertificationWhenDeclared() throws Exception {
        JsonNode payload = objectMapper.readTree("""
            {
              "iso9001":"YES",
              "accreditationSummary":"Accreditata regione Lombardia",
              "attachments":[
                {"documentType":"VISURA_CAMERALE","fileName":"visura.pdf","storageKey":"s3://visura.pdf"},
                {"documentType":"DURC","fileName":"durc.pdf","storageKey":"s3://durc.pdf"}
              ]
            }
            """);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> validator.validateAndNormalize(RegistryType.ALBO_B, "S4", payload, true, Optional::empty)
        );
        assertTrue(ex.getMessage().contains("CERTIFICATION"));
    }

    @Test
    void contractAlboAAllCanonicalSectionsAreAcceptedWhenCompleted() throws Exception {
        JsonNode s1 = objectMapper.readTree("""
            {
              "firstName":"Mario",
              "lastName":"Rossi",
              "birthDate":"1980-01-01",
              "birthPlace":"Milano",
              "taxCode":"RSSMRA80A01F205X",
              "addressLine":"Via Roma 1",
              "city":"Milano",
              "postalCode":"20100",
              "province":"MI",
              "phone":"+3902000001",
              "email":"mario.rossi@example.com"
            }
            """);
        JsonNode s2 = objectMapper.readTree("""
            {
              "professionalType":"DOCENTE_FORMATORE",
              "secondaryProfessionalTypes":["CONSULENTE"]
            }
            """);
        JsonNode s3a = objectMapper.readTree("""
            {
              "education":{"highestTitle":"Laurea","studyArea":"HR","graduationYear":"2010"},
              "competencies":[{"theme":"Digital Learning","details":"LMS e SCORM","yearsBand":"Y5_10"}],
              "experiences":[{"deliveryMode":"IN_PRESENCE","clientName":"ACME","interventionType":"Docenza","mainTheme":"Digital Learning"}],
              "availability":{"inPresence":true}
            }
            """);
        JsonNode s3b = objectMapper.readTree("""
            {
              "professionalOrder":"Ordine Formatori",
              "highestTitle":"Laurea",
              "studyArea":"Formazione",
              "experienceBand":"Y5_10",
              "services":["Docenza","Mentoring"],
              "territory":{"regionsCsv":"Lombardia","provincesCsv":"MI"},
              "hourlyRateRange":"80-120 EUR"
            }
            """);
        JsonNode s4 = objectMapper.readTree("""
            {
              "operationalCapacity":"Gestione percorsi aula/blended",
              "references":[{"fullName":"Laura Bianchi","organizationRole":"HR Manager","email":"laura@example.com","phone":"+3902123"}],
              "attachments":[{"documentType":"CV","fileName":"cv.pdf","storageKey":"s3://docs/cv.pdf"}]
            }
            """);
        JsonNode s5 = objectMapper.readTree("""
            {
              "truthfulnessDeclaration": true,
              "noConflictOfInterest": true,
              "noCriminalConvictions": true,
              "privacyAccepted": true,
              "ethicalCodeAccepted": true,
              "qualityEnvSafetyAccepted": true,
              "alboDataProcessingConsent": true,
              "marketingConsent": false,
              "dlgs81ComplianceWhenInPresence": true
            }
            """);

        assertDoesNotThrow(() -> validator.validateAndNormalize(RegistryType.ALBO_A, "S1", s1, true, Optional::empty));
        assertDoesNotThrow(() -> validator.validateAndNormalize(RegistryType.ALBO_A, "S2", s2, true, Optional::empty));
        assertDoesNotThrow(() -> validator.validateAndNormalize(RegistryType.ALBO_A, "S3A", s3a, true, Optional::empty));
        assertDoesNotThrow(() -> validator.validateAndNormalize(RegistryType.ALBO_A, "S3B", s3b, true, Optional::empty));
        assertDoesNotThrow(() -> validator.validateAndNormalize(RegistryType.ALBO_A, "S4", s4, true, Optional::empty));
        assertDoesNotThrow(() -> validator.validateAndNormalize(RegistryType.ALBO_A, "S5", s5, true, () -> Optional.of(s3a)));
    }

    @Test
    void contractAlboBAllCanonicalSectionsAreAcceptedWhenCompleted() throws Exception {
        JsonNode s1 = objectMapper.readTree("""
            {
              "companyName":"Alpha Formazione S.r.l.",
              "legalForm":"SRL",
              "vatNumber":"12345678901",
              "reaNumber":"MI-1234567",
              "cciaaProvince":"MI",
              "incorporationDate":"2018-06",
              "legalAddress":{"street":"Via Roma 1","city":"Milano","cap":"20100","province":"MI"},
              "institutionalEmail":"info@alpha.it",
              "phone":"+3902123456",
              "legalRepresentative":{"name":"Mario Rossi","taxCode":"RSSMRA80A01F205X","role":"Amministratore"},
              "operationalContact":{"name":"Laura Bianchi","email":"ops@alpha.it","phone":"+3902111111"}
            }
            """);
        JsonNode s2 = objectMapper.readTree("""
            {
              "employeeRange":"E_10_49",
              "atecoPrimary":"85.59",
              "revenueBand":"R_100_500K",
              "operatingRegions":[{"region":"Lombardia","provincesCsv":"MI,MB"}],
              "atecoSecondary":["70.22"],
              "regionalTrainingAccreditation":{"isAccredited":true,"regions":["Lombardia"]},
              "thirdSectorType":"",
              "runtsNumber":""
            }
            """);
        JsonNode s3 = objectMapper.readTree("""
            {
              "servicesByCategory":{"CAT_A":["TRAINING_DESIGN"]},
              "descriptionsByCategory":{"CAT_A":"Progettazione e docenza percorsi formativi"}
            }
            """);
        JsonNode s4 = objectMapper.readTree("""
            {
              "iso9001":"YES",
              "accreditationSummary":"Accreditata Regione Lombardia",
              "attachments":[
                {"documentType":"VISURA_CAMERALE","fileName":"visura.pdf","storageKey":"s3://docs/visura.pdf"},
                {"documentType":"DURC","fileName":"durc.pdf","storageKey":"s3://docs/durc.pdf"},
                {"documentType":"CERTIFICATION","fileName":"cert.pdf","storageKey":"s3://docs/cert.pdf"}
              ]
            }
            """);
        JsonNode s5 = objectMapper.readTree("""
            {
              "truthfulnessDeclaration": true,
              "noConflictOfInterest": true,
              "noCriminalConvictions": true,
              "privacyAccepted": true,
              "ethicalCodeAccepted": true,
              "qualityEnvSafetyAccepted": true,
              "alboDataProcessingConsent": true,
              "marketingConsent": false,
              "antimafiaDeclaration": true,
              "dlgs231Declaration": true,
              "model231Adopted": false,
              "fiscalContributionRegularity": true,
              "gdprComplianceAndDpo": true
            }
            """);

        assertDoesNotThrow(() -> validator.validateAndNormalize(RegistryType.ALBO_B, "S1", s1, true, Optional::empty));
        assertDoesNotThrow(() -> validator.validateAndNormalize(RegistryType.ALBO_B, "S2", s2, true, Optional::empty));
        assertDoesNotThrow(() -> validator.validateAndNormalize(RegistryType.ALBO_B, "S3", s3, true, Optional::empty));
        assertDoesNotThrow(() -> validator.validateAndNormalize(RegistryType.ALBO_B, "S4", s4, true, Optional::empty));
        assertDoesNotThrow(() -> validator.validateAndNormalize(RegistryType.ALBO_B, "S5", s5, true, Optional::empty));
    }
}
