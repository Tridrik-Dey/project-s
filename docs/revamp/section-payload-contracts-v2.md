# Revamp Section Payload Contracts (JSONB Canonical)

Scope:
- Table: `application_sections`
- Column: `payload_json` (`jsonb`)
- Section keys: `S1`, `S2`, `S3A`, `S3B`, `S3`, `S4`, `S5`
- Registry types: `ALBO_A`, `ALBO_B`

Conventions:
- Required fields are marked `(required)`.
- Arrays default to `[]` when omitted.
- Objects default to `{}` when omitted.
- Unknown keys are not part of contract and should be rejected by backend validation.

## Common enums

### RegistryType
- `ALBO_A`
- `ALBO_B`

### ProfessionalType (ALBO_A S2)
- `DOCENTE_FORMATORE`
- `CONSULENTE`
- `PSICOLOGO_COACH`
- `ALTRO`

### YearsBand
- `LT_1`
- `Y1_3`
- `Y3_5`
- `Y5_10`
- `Y10_15`
- `GT_15`

### EmployeeRange (ALBO_B S2)
- `E_1_9`
- `E_10_49`
- `E_50_249`
- `E_250_PLUS`

### RevenueBand (ALBO_B S2)
- `R_LT_100K`
- `R_100K_500K`
- `R_500K_2M`
- `R_2M_10M`
- `R_GT_10M`

### LegalForm (ALBO_B S1)
- `SRL`
- `SPA`
- `SNC`
- `SAS`
- `COOPERATIVA`
- `ASSOCIAZIONE`
- `FONDAZIONE`
- `ETS`
- `ALTRO`

### QcerLevel
- `A1`
- `A2`
- `B1`
- `B2`
- `C1`
- `C2`
- `NATIVE`

## ALBO_A contracts

### S1 - Anagrafica (ALBO_A)
```json
{
  "firstName": "string",
  "lastName": "string",
  "birthDate": "YYYY-MM-DD",
  "birthPlace": "string",
  "taxCode": "string",
  "vatNumber": "string|null",
  "taxRegime": "string|null",
  "addressLine": "string",
  "city": "string",
  "postalCode": "string",
  "province": "string",
  "phone": "string",
  "secondaryPhone": "string|null",
  "email": "string",
  "secondaryEmail": "string|null",
  "pec": "string|null",
  "website": "string|null",
  "linkedin": "string|null",
  "profilePhotoRef": "uuid|null"
}
```
Required:
- `firstName`, `lastName`, `birthDate`, `birthPlace`, `taxCode`, `addressLine`, `city`, `postalCode`, `province`, `phone`, `email`

### S2 - Tipologia professionale (ALBO_A)
```json
{
  "professionalType": "DOCENTE_FORMATORE|CONSULENTE|PSICOLOGO_COACH|ALTRO",
  "secondaryProfessionalTypes": ["enum..."],
  "atecoCode": "string|null"
}
```
Required:
- `professionalType`
Conditional:
- if `professionalType == ALTRO`, then `atecoCode` required.

### S3A - Docente/Formatore (ALBO_A)
```json
{
  "education": {
    "highestTitle": "string",
    "studyArea": "string",
    "graduationYear": 2020
  },
  "certifications": [
    {
      "name": "string",
      "issuer": "string|null",
      "year": 2024
    }
  ],
  "competencies": [
    {
      "theme": "string",
      "details": "string",
      "yearsBand": "LT_1|Y1_3|Y3_5|Y5_10|Y10_15|GT_15"
    }
  ],
  "paTeachingExperience": true,
  "consultingAreas": ["string..."],
  "territory": {
    "regions": ["string..."],
    "provinces": ["string..."]
  },
  "languages": [
    {
      "language": "string",
      "qcerLevel": "A1|A2|B1|B2|C1|C2|NATIVE"
    }
  ],
  "teachingLanguages": ["string..."],
  "digitalTools": ["string..."],
  "professionalNetworks": ["string..."],
  "availability": {
    "travelAvailable": true,
    "dailyRateRange": "string|null",
    "hourlyRateRange": "string|null"
  },
  "experiences": [
    {
      "clientName": "string",
      "clientSector": "string",
      "interventionType": "string",
      "mainTheme": "string",
      "periodFrom": "YYYY-MM-DD",
      "periodTo": "YYYY-MM-DD",
      "durationHours": 12,
      "participantsCount": 30,
      "deliveryMode": "IN_PRESENCE|ONLINE|BLENDED",
      "fundedIntervention": false,
      "fundName": "string|null"
    }
  ]
}
```
Required:
- `competencies` length >= 1
- `experiences` length <= 5

### S3B - Altri professionisti (ALBO_A)
```json
{
  "professionalOrder": "string|null",
  "highestTitle": "string",
  "studyArea": "string|null",
  "experienceBand": "LT_1|Y1_3|Y3_5|Y5_10|Y10_15|GT_15",
  "services": ["string..."],
  "territory": {
    "regions": ["string..."],
    "provinces": ["string..."]
  },
  "hourlyRateRange": "string|null",
  "specificCertifications": ["string..."]
}
```
Required:
- `highestTitle`, `experienceBand`, `services` length >= 1

### S4 - Referenze (ALBO_A)
```json
{
  "references": [
    {
      "fullName": "string",
      "organizationRole": "string",
      "email": "string|null",
      "phone": "string|null"
    }
  ]
}
```
Required:
- Optional section.
- if present, `references` length <= 2.

### S5 - Dichiarazioni (ALBO_A)
```json
{
  "noCriminalConvictions": true,
  "noConflictOfInterest": true,
  "truthfulnessDeclaration": true,
  "privacyAccepted": true,
  "ethicalCodeAccepted": true,
  "qualityEnvSafetyAccepted": true,
  "alboDataProcessingConsent": true,
  "marketingConsent": false,
  "dlgs81ComplianceWhenInPresence": true,
  "otpChallengeId": "uuid",
  "otpVerified": true
}
```
Required:
- all booleans except `marketingConsent` (optional, default false)
Conditional:
- if `S3A.availability.travelAvailable == true` or presence delivery exists, require `dlgs81ComplianceWhenInPresence == true`.

## ALBO_B contracts

### S1 - Dati aziendali (ALBO_B)
```json
{
  "companyName": "string",
  "legalForm": "SRL|SPA|SNC|SAS|COOPERATIVA|ASSOCIAZIONE|FONDAZIONE|ETS|ALTRO",
  "vatNumber": "string",
  "taxCodeIfDifferent": "string|null",
  "reaNumber": "string",
  "cciaaProvince": "string",
  "incorporationDate": "YYYY-MM-DD",
  "legalAddress": {
    "street": "string",
    "city": "string",
    "postalCode": "string",
    "province": "string"
  },
  "operationalHeadquarter": {
    "street": "string|null",
    "city": "string",
    "postalCode": "string|null",
    "province": "string"
  },
  "institutionalEmail": "string",
  "pec": "string",
  "phone": "string",
  "website": "string|null",
  "legalRepresentative": {
    "name": "string",
    "taxCode": "string",
    "role": "string"
  },
  "operationalContact": {
    "name": "string",
    "role": "string",
    "email": "string",
    "phone": "string"
  }
}
```
Required:
- all except nullable fields.

### S2 - Struttura/dimensione/settore (ALBO_B)
```json
{
  "employeeRange": "E_1_9|E_10_49|E_50_249|E_250_PLUS",
  "revenueBand": "R_LT_100K|R_100K_500K|R_500K_2M|R_2M_10M|R_GT_10M",
  "atecoPrimary": "string",
  "atecoSecondary": ["string..."],
  "operatingRegions": ["string..."],
  "regionalTrainingAccreditation": {
    "accredited": true,
    "authority": "string|null",
    "code": "string|null",
    "expiryDate": "YYYY-MM-DD|null"
  },
  "thirdSectorType": "string|null",
  "runtsNumber": "string|null"
}
```
Required:
- `employeeRange`, `revenueBand`, `atecoPrimary`, `operatingRegions` length >= 1
- `atecoSecondary` length <= 3

### S3 - Servizi per categoria (ALBO_B)
```json
{
  "servicesByCategory": {
    "CAT_A": ["SERVICE_ID..."],
    "CAT_B": ["SERVICE_ID..."],
    "CAT_C": ["SERVICE_ID..."],
    "CAT_D": ["SERVICE_ID..."],
    "CAT_E": ["SERVICE_ID..."]
  },
  "descriptionsByCategory": {
    "CAT_A": "string|null",
    "CAT_B": "string|null",
    "CAT_C": "string|null",
    "CAT_D": "string|null",
    "CAT_E": "string|null"
  }
}
```
Required:
- At least one service in one category.
Conditional:
- For each category with selected services, matching description required (max 400 chars).

### S4 - Certificazioni/accreditamenti (ALBO_B)
```json
{
  "iso9001": {
    "declared": true,
    "issuer": "string|null",
    "expiryDate": "YYYY-MM-DD|null",
    "attachmentRef": "uuid|null"
  },
  "iso14001": {
    "declared": false,
    "issuer": "string|null",
    "expiryDate": "YYYY-MM-DD|null",
    "attachmentRef": "uuid|null"
  },
  "iso45001": {
    "declared": false,
    "issuer": "string|null",
    "expiryDate": "YYYY-MM-DD|null",
    "attachmentRef": "uuid|null"
  },
  "sa8000": {
    "declared": false,
    "issuer": "string|null",
    "expiryDate": "YYYY-MM-DD|null",
    "attachmentRef": "uuid|null"
  },
  "iso27001": {
    "declared": false,
    "issuer": "string|null",
    "expiryDate": "YYYY-MM-DD|null",
    "attachmentRef": "uuid|null"
  },
  "additionalCertifications": [
    {
      "name": "string",
      "issuer": "string|null",
      "expiryDate": "YYYY-MM-DD|null",
      "attachmentRef": "uuid|null"
    }
  ],
  "accreditations": [
    {
      "type": "REGIONAL_TRAINING|LABOR_SERVICES|OTHER",
      "authority": "string",
      "code": "string|null",
      "expiryDate": "YYYY-MM-DD|null",
      "attachmentRef": "uuid|null"
    }
  ]
}
```

### S5 - Dichiarazioni e conformita (ALBO_B)
```json
{
  "antimafiaDeclaration": true,
  "dlgs231Declaration": true,
  "model231Adopted": false,
  "fiscalContributionRegularity": true,
  "gdprComplianceAndDpo": true,
  "truthfulnessDeclaration": true,
  "privacyAccepted": true,
  "ethicalCodeAccepted": true,
  "qualityEnvSafetyAccepted": true,
  "alboDataProcessingConsent": true,
  "marketingConsent": false,
  "otpChallengeId": "uuid",
  "otpVerified": true
}
```
Required:
- all booleans except `marketingConsent` (optional default false).

## Transitional compatibility (existing payloads)

During rollout, backend may accept old keys but should up-convert to canonical keys:
- `thematicAreasCsv` -> `competencies[]`
- `referencesSummary` -> `references[]`
- `specialization` -> `services[]`
- `operationalScope` -> `territory`
- generic S5 declarations -> explicit keys

