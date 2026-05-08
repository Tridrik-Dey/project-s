package com.supplierplatform.revamp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.revamp.enums.ApplicationStatus;
import com.supplierplatform.revamp.enums.RegistryProfileStatus;
import com.supplierplatform.revamp.enums.RegistryType;
import com.supplierplatform.revamp.model.RevampApplication;
import com.supplierplatform.revamp.model.RevampApplicationSection;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfile;
import com.supplierplatform.revamp.model.RevampSupplierRegistryProfileDetail;
import com.supplierplatform.revamp.repository.RevampApplicationRepository;
import com.supplierplatform.revamp.repository.RevampApplicationSectionRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileDetailRepository;
import com.supplierplatform.revamp.repository.RevampSupplierRegistryProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RevampProfileProjectionService {

    private final RevampApplicationRepository applicationRepository;
    private final RevampApplicationSectionRepository sectionRepository;
    private final RevampSupplierRegistryProfileRepository profileRepository;
    private final RevampSupplierRegistryProfileDetailRepository profileDetailRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public RevampSupplierRegistryProfile projectApprovedApplication(UUID applicationId) {
        RevampApplication application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new EntityNotFoundException("RevampApplication", applicationId));
        if (application.getStatus() != ApplicationStatus.APPROVED) {
            throw new IllegalStateException("Profile projection allowed only for APPROVED applications");
        }
        if (application.getApplicantUser() == null) {
            throw new IllegalStateException("Approved application has no applicant user");
        }

        List<RevampApplicationSection> latestSections = sectionRepository.findByApplicationIdAndIsLatestTrue(applicationId);
        Map<String, JsonNode> sections = latestSections.stream()
                .collect(Collectors.toMap(
                        s -> s.getSectionKey() == null ? "" : s.getSectionKey().toUpperCase(Locale.ROOT),
                        RevampApplicationSection::getPayloadJson,
                        (a, b) -> b,
                        LinkedHashMap::new
                ));

        JsonNode s1 = sections.get("S1");
        JsonNode s2 = sections.get("S2");
        JsonNode s3 = application.getRegistryType() == RegistryType.ALBO_A
                ? firstNonNull(sections.get("S3A"), sections.get("S3B"))
                : sections.get("S3");
        JsonNode s4 = sections.get("S4");

        RevampSupplierRegistryProfile profile = profileRepository.findByApplicationId(applicationId).orElseGet(RevampSupplierRegistryProfile::new);
        profile.setApplication(application);
        profile.setSupplierUser(application.getApplicantUser());
        profile.setRegistryType(application.getRegistryType());
        profile.setStatus(RegistryProfileStatus.APPROVED);
        profile.setIsVisible(true);
        profile.setApprovedAt(application.getApprovedAt() != null ? application.getApprovedAt() : LocalDateTime.now());
        profile.setDisplayName(buildDisplayName(application.getRegistryType(), s1));
        profile.setPublicSummary(buildPublicSummary(application.getRegistryType(), s2, s3, s4));
        RevampSupplierRegistryProfile savedProfile = profileRepository.save(profile);

        ObjectNode projected = objectMapper.createObjectNode();
        projected.put("applicationId", application.getId().toString());
        projected.put("registryType", application.getRegistryType().name());
        projected.put("projectedAt", LocalDateTime.now().toString());
        ObjectNode projectedSections = projected.putObject("sections");
        sections.forEach(projectedSections::set);
        projected.set("search", buildSearchNode(application.getRegistryType(), s2, s3, s4));
        projected.set("publicCardView", buildPublicCardView(application.getRegistryType(), savedProfile, s2, s3));
        projected.set("adminCardView", buildAdminCardView(application.getRegistryType(), savedProfile, s2, s3, s4));

        RevampSupplierRegistryProfileDetail detail = profileDetailRepository.findByProfileId(savedProfile.getId())
                .orElseGet(RevampSupplierRegistryProfileDetail::new);
        detail.setProfile(savedProfile);
        detail.setProjectedJson(projected);
        detail.setSearchAtecoPrimary(extractText(s2, "atecoPrimary"));
        detail.setSearchRegionsCsv(buildRegionsCsv(application.getRegistryType(), s2, s3));
        detail.setSearchServiceCategoriesCsv(buildServiceCategoriesCsv(application.getRegistryType(), s3));
        detail.setSearchCertificationsCsv(buildCertificationsCsv(s4));
        profileDetailRepository.save(detail);

        return savedProfile;
    }

    private ObjectNode buildSearchNode(RegistryType registryType, JsonNode s2, JsonNode s3, JsonNode s4) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("atecoPrimary", nullToEmpty(extractText(s2, "atecoPrimary")));
        node.put("regionsCsv", nullToEmpty(buildRegionsCsv(registryType, s2, s3)));
        node.put("serviceCategoriesCsv", nullToEmpty(buildServiceCategoriesCsv(registryType, s3)));
        node.put("certificationsCsv", nullToEmpty(buildCertificationsCsv(s4)));
        return node;
    }

    private ObjectNode buildPublicCardView(
            RegistryType registryType,
            RevampSupplierRegistryProfile profile,
            JsonNode s2,
            JsonNode s3
    ) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("displayName", nullToEmpty(profile.getDisplayName()));
        node.put("registryType", registryType.name());
        node.put("score", profile.getAggregateScore() != null ? profile.getAggregateScore().doubleValue() : 0.0d);
        if (registryType == RegistryType.ALBO_A) {
            node.put("type", nullToEmpty(extractText(s2, "professionalType")));
            node.put("territory", nullToEmpty(buildRegionsCsv(registryType, s2, s3)));
            node.put("mainTheme", nullToEmpty(extractText(s3, "studyArea")));
        } else {
            node.put("atecoPrimary", nullToEmpty(extractText(s2, "atecoPrimary")));
            node.put("employeeRange", nullToEmpty(extractText(s2, "employeeRange")));
            node.put("revenueBand", nullToEmpty(extractText(s2, "revenueBand")));
            node.put("territory", nullToEmpty(buildRegionsCsv(registryType, s2, s3)));
        }
        return node;
    }

    private ObjectNode buildAdminCardView(
            RegistryType registryType,
            RevampSupplierRegistryProfile profile,
            JsonNode s2,
            JsonNode s3,
            JsonNode s4
    ) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("displayName", nullToEmpty(profile.getDisplayName()));
        node.put("status", profile.getStatus() != null ? profile.getStatus().name() : "");
        node.put("visible", Boolean.TRUE.equals(profile.getIsVisible()));
        node.put("expiresAt", profile.getExpiresAt() != null ? profile.getExpiresAt().toString() : "");
        node.put("updatedAt", profile.getUpdatedAt() != null ? profile.getUpdatedAt().toString() : "");
        node.put("score", profile.getAggregateScore() != null ? profile.getAggregateScore().doubleValue() : 0.0d);
        node.put("atecoPrimary", nullToEmpty(extractText(s2, "atecoPrimary")));
        node.put("territory", nullToEmpty(buildRegionsCsv(registryType, s2, s3)));
        node.put("serviceCategoriesCsv", nullToEmpty(buildServiceCategoriesCsv(registryType, s3)));
        node.put("certificationsCsv", nullToEmpty(buildCertificationsCsv(s4)));
        if (registryType == RegistryType.ALBO_A) {
            node.put("type", nullToEmpty(extractText(s2, "professionalType")));
            node.put("mainTheme", nullToEmpty(extractText(s3, "studyArea")));
        } else {
            node.put("employeeRange", nullToEmpty(extractText(s2, "employeeRange")));
            node.put("revenueBand", nullToEmpty(extractText(s2, "revenueBand")));
        }
        return node;
    }

    private String buildDisplayName(RegistryType registryType, JsonNode s1) {
        if (registryType == RegistryType.ALBO_B) {
            String company = extractText(s1, "companyName");
            if (!isBlank(company)) return company;
        }
        String firstName = extractText(s1, "firstName");
        String lastName = extractText(s1, "lastName");
        String fullName = (nullToEmpty(firstName) + " " + nullToEmpty(lastName)).trim();
        if (!isBlank(fullName)) return fullName;
        String legalRepresentative = extractText(s1, "legalRepresentativeName");
        if (!isBlank(legalRepresentative)) return legalRepresentative;
        return "Profilo " + registryType.name();
    }

    private String buildPublicSummary(RegistryType registryType, JsonNode s2, JsonNode s3, JsonNode s4) {
        List<String> tokens = new java.util.ArrayList<>();
        if (registryType == RegistryType.ALBO_A) {
            tokens.add(extractText(s2, "professionalType"));
            tokens.add(extractText(s3, "studyArea"));
            tokens.add(extractText(s3, "yearsExperience"));
            tokens.add(extractText(s3, "hourlyRateRange"));
        } else {
            tokens.add(extractText(s2, "atecoPrimary"));
            tokens.add(extractText(s2, "employeeRange"));
            tokens.add(extractText(s2, "revenueBand"));
            tokens.add(extractText(s4, "accreditationSummary"));
        }
        return tokens.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(v -> !v.isEmpty())
                .distinct()
                .limit(4)
                .collect(Collectors.joining(" | "));
    }

    private String buildRegionsCsv(RegistryType registryType, JsonNode s2, JsonNode s3) {
        if (registryType == RegistryType.ALBO_B) {
            JsonNode regions = s2 != null ? s2.path("operatingRegions") : null;
            if (regions != null && regions.isArray()) {
                return streamArray(regions)
                        .map(item -> item.path("region").asText("").trim())
                        .filter(v -> !v.isBlank())
                        .distinct()
                        .collect(Collectors.joining(","));
            }
            return extractText(s2, "operatingRegions");
        }
        JsonNode territory = s3 != null ? s3.path("territory") : null;
        if (territory != null && territory.isObject()) {
            String regionsCsv = territory.path("regionsCsv").asText("").trim();
            if (!regionsCsv.isBlank()) return regionsCsv;
        }
        return extractText(s3, "territory");
    }

    private String buildServiceCategoriesCsv(RegistryType registryType, JsonNode s3) {
        if (s3 == null || s3.isNull()) return null;
        if (registryType == RegistryType.ALBO_B && s3.path("servicesByCategory").isObject()) {
            return streamFieldNames(s3.path("servicesByCategory"))
                    .collect(Collectors.joining(","));
        }
        return extractText(s3, "serviceCategoriesCsv");
    }

    private String buildCertificationsCsv(JsonNode s4) {
        if (s4 == null || s4.isNull()) return null;
        if (s4.path("accreditations").isArray()) {
            return streamArray(s4.path("accreditations"))
                    .map(JsonNode::asText)
                    .map(String::trim)
                    .filter(v -> !v.isEmpty())
                    .distinct()
                    .collect(Collectors.joining(","));
        }
        return extractText(s4, "accreditationSummary");
    }

    private JsonNode firstNonNull(JsonNode first, JsonNode second) {
        if (first != null && !first.isNull()) return first;
        return second;
    }

    private String extractText(JsonNode node, String field) {
        if (node == null || node.isNull()) return null;
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) return null;
        if (value.isTextual()) return value.asText();
        if (value.isNumber() || value.isBoolean()) return value.asText();
        return value.toString();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private java.util.stream.Stream<JsonNode> streamArray(JsonNode node) {
        Iterable<JsonNode> iterable = node::elements;
        return java.util.stream.StreamSupport.stream(iterable.spliterator(), false);
    }

    private java.util.stream.Stream<String> streamFieldNames(JsonNode node) {
        Iterable<String> iterable = node::fieldNames;
        return java.util.stream.StreamSupport.stream(iterable.spliterator(), false);
    }
}
